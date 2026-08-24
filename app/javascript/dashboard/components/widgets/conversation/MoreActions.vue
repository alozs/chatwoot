<script setup>
import { computed, onUnmounted, ref } from 'vue';
import { useToggle } from '@vueuse/core';
import { useAdmin } from 'dashboard/composables/useAdmin';
import Dialog from 'dashboard/components-next/dialog/Dialog.vue';
import { useStore } from 'vuex';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';
import { emitter } from 'shared/helpers/mitt';
import EmailTranscriptModal from './EmailTranscriptModal.vue';
import EditContact from 'dashboard/routes/dashboard/conversation/contact/EditContact.vue';
import ResolveAction from '../../buttons/ResolveAction.vue';
import ButtonV4 from 'dashboard/components-next/button/Button.vue';
import DropdownMenu from 'dashboard/components-next/dropdown-menu/DropdownMenu.vue';

import { useRoute, useRouter } from 'vue-router';
import {
  CMD_MUTE_CONVERSATION,
  CMD_SEND_TRANSCRIPT,
  CMD_UNMUTE_CONVERSATION,
  CMD_SNOOZE_NOTIFICATION,
  CMD_DELETE_NOTIFICATION,
  CMD_SET_DASHBOARD_APP_TAB,
} from 'dashboard/helper/commandbar/events';

// No props needed as we're getting currentChat from the store directly
const store = useStore();
const { t } = useI18n();

const [showEmailActionsModal, toggleEmailModal] = useToggle(false);
const [showActionsDropdown, toggleDropdown] = useToggle(false);
const [showEditContactPanel, toggleEditContactPanel] = useToggle(false);

const currentChat = computed(() => store.getters.getSelectedChat);

// Contato do WhatsApp chega so com o numero como nome; este atalho abre a
// edicao do contato sem precisar do painel lateral.
const currentContact = computed(() =>
  store.getters['contacts/getContact'](currentChat.value.meta?.sender?.id)
);

// Na Caixa de Entrada havia dois menus de tres pontos empilhados, um por
// barra. As acoes da notificacao vem para ca; o InboxItemHeader continua
// dono da logica e do modal, e responde pelos eventos abaixo.
const route = useRoute();

const router = useRouter();
const { isAdmin } = useAdmin();

// Excluir tambem daqui: o caminho ja existia no menu de contexto do card,
// mas com a conversa aberta o unico menu a mao e este.
const deleteConversationDialogRef = ref(null);

const confirmDeleteConversation = async () => {
  try {
    await store.dispatch('deleteConversation', currentChat.value.id);
    deleteConversationDialogRef.value?.close();
    useAlert(t('CONVERSATION.SUCCESS_DELETE_CONVERSATION'));
    const accountId = route.params.accountId;
    if (route.name?.startsWith('inbox_view')) {
      router.push({ name: 'inbox_view', params: { accountId } });
    } else {
      router.push({ path: `/app/accounts/${accountId}/dashboard` });
    }
  } catch {
    useAlert(t('CONVERSATION.FAIL_DELETE_CONVERSATION'));
  }
};
const isInboxView = computed(() => route.name === 'inbox_view');

// As abas dos Dashboard Apps ocupavam uma faixa propria de 40px acima das
// mensagens. Viram itens daqui; a faixa deixou de ser renderizada.
const dashboardApps = computed(
  () => store.getters['dashboardApps/getRecords'] || []
);

const dashboardAppMenuItems = computed(() =>
  dashboardApps.value.length
    ? [
        {
          icon: 'i-lucide-messages-square',
          label: t('CONVERSATION.DASHBOARD_APP_TAB_MESSAGES'),
          action: 'dashboard-app-0',
          value: 'dashboard-app-0',
        },
        ...dashboardApps.value.map((app, index) => ({
          icon: 'i-lucide-layout-panel-left',
          label: app.title,
          action: `dashboard-app-${index + 1}`,
          value: `dashboard-app-${index + 1}`,
        })),
      ]
    : []
);

const notificationMenuItems = computed(() =>
  isInboxView.value
    ? [
        {
          icon: 'i-lucide-bell-minus',
          label: t('INBOX.ACTION_HEADER.SNOOZE'),
          action: 'snooze-notification',
          value: 'snooze-notification',
        },
        {
          icon: 'i-lucide-trash-2',
          label: t('INBOX.ACTION_HEADER.DELETE'),
          action: 'delete-notification',
          value: 'delete-notification',
        },
      ]
    : []
);

const actionMenuItems = computed(() => {
  const items = [];

  if (!currentChat.value.muted) {
    items.push({
      icon: 'i-lucide-volume-off',
      label: t('CONTACT_PANEL.MUTE_CONTACT'),
      action: 'mute',
      value: 'mute',
    });
  } else {
    items.push({
      icon: 'i-lucide-volume-1',
      label: t('CONTACT_PANEL.UNMUTE_CONTACT'),
      action: 'unmute',
      value: 'unmute',
    });
  }

  items.push({
    icon: 'i-lucide-share',
    label: t('CONTACT_PANEL.SEND_TRANSCRIPT'),
    action: 'send_transcript',
    value: 'send_transcript',
  });

  items.push({
    icon: 'i-lucide-user-round-pen',
    label: t('EDIT_CONTACT.BUTTON_LABEL'),
    action: 'edit-contact',
    value: 'edit-contact',
  });

  if (isAdmin.value) {
    items.push({
      icon: 'i-lucide-trash-2',
      label: t('CONVERSATION.CARD_CONTEXT_MENU.DELETE'),
      action: 'delete-conversation',
      value: 'delete-conversation',
    });
  }

  return [
    ...items,
    ...dashboardAppMenuItems.value,
    ...notificationMenuItems.value,
  ];
});

const handleActionClick = ({ action }) => {
  toggleDropdown(false);

  if (action === 'mute') {
    store.dispatch('muteConversation', currentChat.value.id);
    useAlert(t('CONTACT_PANEL.MUTED_SUCCESS'));
  } else if (action === 'unmute') {
    store.dispatch('unmuteConversation', currentChat.value.id);
    useAlert(t('CONTACT_PANEL.UNMUTED_SUCCESS'));
  } else if (action === 'send_transcript') {
    toggleEmailModal();
  } else if (action === 'edit-contact') {
    toggleEditContactPanel(true);
  } else if (action === 'snooze-notification') {
    emitter.emit(CMD_SNOOZE_NOTIFICATION);
  } else if (action === 'delete-notification') {
    emitter.emit(CMD_DELETE_NOTIFICATION);
  } else if (action === 'delete-conversation') {
    deleteConversationDialogRef.value?.open();
  } else if (action.startsWith('dashboard-app-')) {
    emitter.emit(
      CMD_SET_DASHBOARD_APP_TAB,
      Number(action.replace('dashboard-app-', ''))
    );
  }
};

// These functions are needed for the event listeners
const mute = () => {
  store.dispatch('muteConversation', currentChat.value.id);
  useAlert(t('CONTACT_PANEL.MUTED_SUCCESS'));
};

const unmute = () => {
  store.dispatch('unmuteConversation', currentChat.value.id);
  useAlert(t('CONTACT_PANEL.UNMUTED_SUCCESS'));
};

emitter.on(CMD_MUTE_CONVERSATION, mute);
emitter.on(CMD_UNMUTE_CONVERSATION, unmute);
emitter.on(CMD_SEND_TRANSCRIPT, toggleEmailModal);

onUnmounted(() => {
  emitter.off(CMD_MUTE_CONVERSATION, mute);
  emitter.off(CMD_UNMUTE_CONVERSATION, unmute);
  emitter.off(CMD_SEND_TRANSCRIPT, toggleEmailModal);
});
</script>

<template>
  <div class="relative flex items-center gap-2 actions--container">
    <ResolveAction
      :conversation-id="currentChat.id"
      :status="currentChat.status"
    />
    <div
      v-on-clickaway="() => toggleDropdown(false)"
      class="relative flex items-center group"
    >
      <ButtonV4
        v-tooltip="$t('CONVERSATION.HEADER.MORE_ACTIONS')"
        size="sm"
        variant="ghost"
        color="slate"
        icon="i-lucide-more-vertical"
        class="rounded-md group-hover:bg-n-alpha-2"
        @click="toggleDropdown()"
      />
      <DropdownMenu
        v-if="showActionsDropdown"
        :menu-items="actionMenuItems"
        class="mt-1 ltr:right-0 rtl:left-0 top-full"
        @action="handleActionClick"
      />
    </div>
    <Dialog
      ref="deleteConversationDialogRef"
      type="alert"
      :title="
        $t('CONVERSATION.DELETE_CONVERSATION.TITLE', {
          conversationId: currentChat.id,
        })
      "
      :description="$t('CONVERSATION.DELETE_CONVERSATION.DESCRIPTION')"
      :confirm-button-label="$t('CONVERSATION.DELETE_CONVERSATION.CONFIRM')"
      @confirm="confirmDeleteConversation"
    />
    <EmailTranscriptModal
      v-if="showEmailActionsModal"
      :show="showEmailActionsModal"
      :current-chat="currentChat"
      @cancel="toggleEmailModal"
    />
    <EditContact
      :show="showEditContactPanel"
      :contact="currentContact"
      @cancel="toggleEditContactPanel(false)"
    />
  </div>
</template>
