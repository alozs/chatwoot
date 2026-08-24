<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useElementSize } from '@vueuse/core';
import BackButton from '../BackButton.vue';
import InboxName from '../InboxName.vue';
import MoreActions from './MoreActions.vue';
import Avatar from 'next/avatar/Avatar.vue';
import SLACardLabel from './components/SLACardLabel.vue';
import ConversationCallButton from './ConversationCallButton.vue';
import wootConstants from 'dashboard/constants/globals';
import { conversationListPageURL } from 'dashboard/helper/URLHelper';
import { snoozedReopenTime } from 'dashboard/helper/snoozeHelpers';
import { contactDisplayName } from 'dashboard/helper/contactNameHelper';
import { useInbox } from 'dashboard/composables/useInbox';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';
import { copyTextToClipboard } from 'shared/helpers/clipboard';
import { downloadFile } from '@chatwoot/utils';
import { isWhatsappNamedApiInbox } from 'dashboard/components-next/icon/provider';

const props = defineProps({
  chat: {
    type: Object,
    default: () => ({}),
  },
  showBackButton: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();
const store = useStore();
const route = useRoute();
const conversationHeader = ref(null);
const { width } = useElementSize(conversationHeader);
const { isAWebWidgetInbox } = useInbox();

const currentChat = computed(() => store.getters.getSelectedChat);
const accountId = computed(() => store.getters.getCurrentAccountId);

const chatMetadata = computed(() => props.chat.meta);

const backButtonUrl = computed(() => {
  const {
    params: { inbox_id: inboxId, label, teamId, id: customViewId },
    name,
  } = route;

  const conversationTypeMap = {
    conversation_through_mentions: 'mention',
    conversation_through_participating: 'participating',
    conversation_through_unattended: 'unattended',
  };
  return conversationListPageURL({
    accountId: accountId.value,
    inboxId,
    label,
    teamId,
    conversationType: conversationTypeMap[name],
    customViewId,
  });
});

const isHMACVerified = computed(() => {
  if (!isAWebWidgetInbox.value) {
    return true;
  }
  return chatMetadata.value.hmac_verified;
});

const currentContact = computed(() =>
  store.getters['contacts/getContact'](props.chat.meta.sender.id)
);

const contactName = computed(() => contactDisplayName(currentContact.value));

const inbox = computed(() => {
  const { inbox_id: inboxId } = props.chat;
  return store.getters['inboxes/getInbox'](inboxId);
});

// Clique no avatar: com foto anexada, baixa o arquivo; sem foto, numa caixa
// de WhatsApp via ponte, busca a foto no WAHA pelo servico avatar-pull — o
// mesmo fluxo do dashboard app "Baixar foto", reaproveitando a URL com token
// ja cadastrada no proprio dashboard app.
const hasContactPhoto = computed(() =>
  Boolean(currentContact.value?.thumbnail)
);

const avatarPullApp = computed(() =>
  (store.getters['dashboardApps/getRecords'] || []).find(app =>
    /avatar-pull/i.test(app.content?.[0]?.url || '')
  )
);

const canPullContactPhoto = computed(() =>
  Boolean(isWhatsappNamedApiInbox(inbox.value) && avatarPullApp.value)
);

const avatarActionTooltip = computed(() => {
  if (hasContactPhoto.value) return t('CONVERSATION.HEADER.DOWNLOAD_PHOTO');
  if (canPullContactPhoto.value) return t('CONVERSATION.HEADER.PULL_PHOTO');
  return '';
});

const isPullingPhoto = ref(false);

const pullContactPhoto = async () => {
  const appUrl = new URL(avatarPullApp.value.content[0].url);
  const response = await fetch(`${appUrl.origin}/pull${appUrl.search}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contact_id: currentContact.value.id,
      conversation_id: currentChat.value.id,
      force: true,
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error || 'pull failed');
};

const downloadContactPhoto = async () => {
  if (hasContactPhoto.value) {
    try {
      await downloadFile({
        url: currentContact.value.thumbnail,
        type: 'image',
      });
    } catch {
      useAlert(t('CONVERSATION.HEADER.DOWNLOAD_PHOTO_ERROR'));
    }
    return;
  }

  if (!canPullContactPhoto.value) {
    useAlert(t('CONVERSATION.HEADER.NO_PHOTO_TO_DOWNLOAD'));
    return;
  }

  if (isPullingPhoto.value) return;
  isPullingPhoto.value = true;
  try {
    await pullContactPhoto();
    useAlert(t('CONVERSATION.HEADER.PULL_PHOTO_SUCCESS'));
    // O anexo roda num job no servidor; rebusca o contato para a miniatura
    // aparecer sem recarregar o painel.
    setTimeout(() => {
      store.dispatch('contacts/show', { id: currentContact.value.id });
    }, 2000);
  } catch {
    useAlert(t('CONVERSATION.HEADER.PULL_PHOTO_ERROR'));
  } finally {
    isPullingPhoto.value = false;
  }
};

// Identifica a conversa alem do nome do contato: no e-mail, o assunto; nos
// canais de mensagem, que nao tem assunto, o telefone do contato — exceto
// quando o nome exibido ja e o proprio telefone.
const headerDetail = computed(() => {
  const detail =
    props.chat?.additional_attributes?.mail_subject ||
    currentContact.value?.phone_number ||
    '';
  return detail === contactName.value ? '' : detail;
});

const isSnoozed = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.SNOOZED
);

const snoozedDisplayText = computed(() => {
  const { snoozed_until: snoozedUntil } = currentChat.value;
  if (snoozedUntil) {
    return `${t('CONVERSATION.HEADER.SNOOZED_UNTIL')} ${snoozedReopenTime(snoozedUntil)}`;
  }
  return t('CONVERSATION.HEADER.SNOOZED_UNTIL_NEXT_REPLY');
});

const hasMultipleInboxes = computed(
  () => store.getters['inboxes/getInboxes'].length > 1
);

const hasSlaPolicyId = computed(
  () => props.chat?.applied_sla?.id && !currentContact.value?.blocked
);

const copyConversationId = async () => {
  try {
    await copyTextToClipboard(String(props.chat.id));
    useAlert(t('CONVERSATION.HEADER.COPY_ID_SUCCESS'));
  } catch (error) {
    // error
  }
};
</script>

<template>
  <div
    ref="conversationHeader"
    class="flex flex-col gap-3 items-center justify-between flex-1 w-full min-w-0 xl:flex-row px-3 pt-3 pb-2 h-24 xl:h-12"
  >
    <div
      class="flex items-center justify-start w-full xl:w-auto max-w-full min-w-0 xl:flex-1"
    >
      <BackButton
        v-if="showBackButton"
        :back-url="backButtonUrl"
        class="me-2"
      />
      <button
        v-tooltip.bottom="avatarActionTooltip"
        type="button"
        class="flex flex-shrink-0 !p-0"
        :class="avatarActionTooltip ? 'cursor-pointer' : 'cursor-default'"
        @click="downloadContactPhoto"
      >
        <Avatar
          :name="contactName"
          :src="currentContact.thumbnail"
          :size="32"
          :status="currentContact.availability_status"
          hide-offline-status
        />
      </button>
      <div class="flex flex-col items-start min-w-0 ms-2 overflow-hidden">
        <div class="flex flex-row items-center max-w-full gap-1 p-0 m-0">
          <span
            class="text-sm font-medium truncate leading-tight text-n-slate-12"
          >
            {{ contactName }}
          </span>
          <fluent-icon
            v-if="!isHMACVerified"
            v-tooltip="$t('CONVERSATION.UNVERIFIED_SESSION')"
            size="14"
            class="text-n-amber-10 my-0 mx-0 min-w-[14px] flex-shrink-0"
            icon="warning"
          />
          <span
            v-if="headerDetail"
            :title="headerDetail"
            class="min-w-0 text-xs truncate text-n-slate-11"
          >
            {{ headerDetail }}
          </span>
        </div>

        <div
          class="flex items-center gap-1 overflow-hidden text-xs conversation--header--actions text-n-slate-11 text-ellipsis whitespace-nowrap"
        >
          <button
            type="button"
            class="truncate text-label-small text-n-slate-11 hover:text-n-slate-12 !p-0 cucursor-pointer"
            @click="copyConversationId"
          >
            {{ `#${chat.id}` }}
          </button>
          <span v-if="hasMultipleInboxes">•</span>
          <InboxName v-if="hasMultipleInboxes" :inbox="inbox" class="!mx-0" />
          <span v-if="isSnoozed">•</span>
          <span v-if="isSnoozed" class="font-medium text-n-amber-10">
            {{ snoozedDisplayText }}
          </span>
        </div>
      </div>
    </div>
    <div
      class="flex flex-row items-center justify-start xl:justify-end flex-shrink-0 gap-2 w-full xl:w-auto header-actions-wrap"
    >
      <SLACardLabel
        v-if="hasSlaPolicyId"
        :chat="chat"
        show-extended-info
        :parent-width="width"
        class="hidden md:flex"
      />
      <ConversationCallButton :inbox="inbox" :chat="currentChat" />
      <MoreActions :conversation-id="currentChat.id" />
    </div>
  </div>
</template>
