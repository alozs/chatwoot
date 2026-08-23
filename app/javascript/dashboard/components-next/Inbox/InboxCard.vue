<script setup>
import { computed, ref, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { getInboxIconByType } from 'dashboard/helper/inbox';
import { dynamicTime, shortTimestamp } from 'shared/helpers/timeHelper';
import {
  snoozedReopenTimeToTimestamp,
  shortenSnoozeTime,
} from 'dashboard/helper/snoozeHelpers';
import { NOTIFICATION_TYPES_MAPPING } from 'dashboard/routes/dashboard/inbox/helpers/InboxViewHelpers';

import Icon from 'dashboard/components-next/icon/Icon.vue';
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import CardPriorityIcon from 'dashboard/components-next/Conversation/ConversationCard/CardPriorityIcon.vue';
import SLACardLabel from 'dashboard/components-next/Conversation/ConversationCard/SLACardLabel.vue';
import InboxContextMenu from 'dashboard/routes/dashboard/inbox/components/InboxContextMenu.vue';

const props = defineProps({
  inboxItem: { type: Object, default: () => ({}) },
  stateInbox: { type: Object, default: () => ({}) },
});

const emit = defineEmits([
  'click',
  'contextMenuOpen',
  'contextMenuClose',
  'markNotificationAsRead',
  'markNotificationAsUnRead',
  'deleteNotification',
]);

const { t } = useI18n();

const isContextMenuOpen = ref(false);
const contextMenuPosition = ref({ x: null, y: null });
const slaCardLabel = ref(null);

// Lido e nao lido diferiam so entre dois cinzas vizinhos. O lido recua para
// slate-10 e o nao lido avanca em peso, para a diferenca aparecer de relance.
const getMessageClasses = {
  emphasis: 'text-[13px] font-medium text-n-slate-10',
  emphasisUnread: 'text-[13px] font-semibold text-n-slate-12',
  normal: 'text-xs font-normal text-n-slate-10 block truncate',
  normalUnread: 'text-xs font-normal text-n-slate-12 block truncate',
};

const primaryActor = computed(() => props.inboxItem?.primaryActor);
const meta = computed(() => primaryActor.value?.meta);
const assigneeMeta = computed(() => meta.value?.sender);
const isUnread = computed(() => !props.inboxItem?.readAt);
const inbox = computed(() => props.stateInbox);

const inboxIcon = computed(() => {
  const { channelType, medium, voiceEnabled } = inbox.value;
  return getInboxIconByType(channelType, medium, 'fill', voiceEnabled);
});

const hasSlaThreshold = computed(() => {
  return slaCardLabel.value?.hasSlaThreshold && primaryActor.value?.slaPolicyId;
});

const lastActivityAt = computed(() => {
  const timestamp = props.inboxItem?.lastActivityAt;
  return timestamp ? shortTimestamp(dynamicTime(timestamp)) : '';
});

const menuItems = computed(() => [
  {
    key: isUnread.value ? 'mark_as_read' : 'mark_as_unread',
    icon: isUnread.value ? 'mail' : 'mail-unread',
    label: t(`INBOX.MENU_ITEM.MARK_AS_${isUnread.value ? 'READ' : 'UNREAD'}`),
  },
  { key: 'delete', icon: 'delete', label: t('INBOX.MENU_ITEM.DELETE') },
]);

const messageClasses = computed(() => ({
  emphasis: isUnread.value
    ? getMessageClasses.emphasisUnread
    : getMessageClasses.emphasis,
  normal: isUnread.value
    ? getMessageClasses.normalUnread
    : getMessageClasses.normal,
}));

// pushMessageBody chega como "remetente: conteudo". Separar os dois permite
// o mesmo layout do card de conversa: nome e hora na primeira linha, previa
// na segunda.
const senderName = computed(() => {
  const body = props.inboxItem?.pushMessageBody || '';
  const [name] = body.split(':');
  return body.includes(':') ? name.trim() : '';
});

const previewText = computed(() => {
  const body = props.inboxItem?.pushMessageBody || '';
  const idx = body.indexOf(':');
  return (idx === -1 ? body : body.slice(idx + 1)).trim();
});

const notificationDetails = computed(() => {
  const type = props.inboxItem?.notificationType?.toUpperCase() || '';
  const [icon = '', color = 'text-n-blue-11'] =
    NOTIFICATION_TYPES_MAPPING[type] || [];
  return { text: type ? t(`INBOX.TYPES_NEXT.${type}`) : '', icon, color };
});

const snoozedUntilTime = computed(() => {
  const { snoozedUntil } = props.inboxItem;
  if (!snoozedUntil) return null;
  return shortenSnoozeTime(
    dynamicTime(snoozedReopenTimeToTimestamp(snoozedUntil))
  );
});

const hasLastSnoozed = computed(() => props.inboxItem?.meta?.lastSnoozedAt);

const snoozedText = computed(() => {
  return !hasLastSnoozed.value
    ? t('INBOX.TYPES_NEXT.SNOOZED_UNTIL', {
        time: shortTimestamp(snoozedUntilTime.value),
      })
    : t('INBOX.TYPES_NEXT.SNOOZED_ENDS');
});

const contextMenuActions = {
  close: () => {
    isContextMenuOpen.value = false;
    contextMenuPosition.value = { x: null, y: null };
    emit('contextMenuClose');
  },
  open: e => {
    e.preventDefault();
    contextMenuPosition.value = {
      x: e.pageX || e.clientX,
      y: e.pageY || e.clientY,
    };
    isContextMenuOpen.value = true;
    emit('contextMenuOpen');
  },
  handle: key => {
    const actions = {
      mark_as_read: () => emit('markNotificationAsRead', props.inboxItem),
      mark_as_unread: () => emit('markNotificationAsUnRead', props.inboxItem),
      delete: () => emit('deleteNotification', props.inboxItem),
    };
    actions[key]?.();
  },
};

onBeforeMount(contextMenuActions.close);
</script>

<template>
  <div
    role="button"
    class="flex w-full gap-2.5 px-3 py-2.5 transition-colors duration-150 ease-out cursor-pointer"
    :class="isUnread ? 'bg-n-blue-2' : 'bg-n-solid-1'"
    @contextmenu="contextMenuActions.open($event)"
    @click="emit('click')"
  >
    <Avatar
      :name="assigneeMeta.name"
      :src="assigneeMeta.thumbnail"
      :size="24"
      rounded-full
    />
    <div class="flex flex-col w-full gap-1 min-w-0">
      <div class="flex items-center justify-between h-5 gap-2">
        <h4
          class="flex items-center min-w-0 gap-1.5 truncate"
          :class="messageClasses.emphasis"
        >
          <span
            v-if="isUnread"
            class="inline-flex flex-shrink-0 rounded-full size-2 bg-n-slate-12"
          />
          {{ senderName }}
        </h4>
        <div class="flex items-center flex-shrink-0 gap-2">
          <Icon
            v-if="snoozedUntilTime || hasLastSnoozed"
            v-tooltip.left="snoozedText"
            :icon="
              !hasLastSnoozed
                ? 'i-lucide-alarm-clock-plus'
                : 'i-lucide-alarm-clock-off'
            "
            class="flex-shrink-0 text-n-slate-11 size-3.5"
          />
          <Icon
            v-else-if="notificationDetails.icon"
            v-tooltip.left="notificationDetails.text"
            :icon="notificationDetails.icon"
            class="flex-shrink-0 size-3.5"
            :class="isUnread ? notificationDetails.color : 'text-n-slate-11'"
          />
          <SLACardLabel
            v-show="hasSlaThreshold"
            ref="slaCardLabel"
            :conversation="primaryActor"
            class="[&>span]:text-xs"
            :class="
              !isUnread &&
              '[&>span]:text-n-slate-11 [&>div>svg]:fill-n-slate-11'
            "
          />
          <div
            v-if="hasSlaThreshold"
            class="w-px h-3 rounded-sm bg-n-slate-4"
          />
          <CardPriorityIcon
            v-if="primaryActor?.priority"
            :priority="primaryActor?.priority"
            class="[&>svg]:size-4"
          />
          <div
            v-if="inboxIcon"
            v-tooltip.left="inbox?.name"
            class="flex items-center justify-center flex-shrink-0 rounded-full bg-n-alpha-2 size-4"
          >
            <Icon
              :icon="inboxIcon"
              class="flex-shrink-0 text-n-slate-11 size-2.5"
            />
          </div>
          <span class="text-xs text-n-slate-10">
            {{ lastActivityAt }}
          </span>
        </div>
      </div>
      <p class="mb-0 truncate" :class="messageClasses.normal">
        {{ previewText }}
      </p>
    </div>
    <InboxContextMenu
      v-if="isContextMenuOpen"
      :context-menu-position="contextMenuPosition"
      :menu-items="menuItems"
      @close="contextMenuActions.close"
      @select-action="contextMenuActions.handle"
    />
  </div>
</template>
