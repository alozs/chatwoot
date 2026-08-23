<script setup>
import { computed, ref, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import InboxContextMenu from 'dashboard/routes/dashboard/inbox/components/InboxContextMenu.vue';
import ConversationCard from 'dashboard/components/widgets/conversation/ConversationCard.vue';
import snakecaseKeys from 'snakecase-keys';

const props = defineProps({
  inboxItem: { type: Object, default: () => ({}) },
  stateInbox: { type: Object, default: () => ({}) },
  isActive: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits([
  'click',
  'contextMenuOpen',
  'contextMenuClose',
  'markNotificationAsRead',
  'markNotificationAsUnRead',
  'deleteNotification',
  'select',
  'deselect',
]);

const { t } = useI18n();

const isContextMenuOpen = ref(false);
const contextMenuPosition = ref({ x: null, y: null });

const primaryActor = computed(() => props.inboxItem?.primaryActor);

// A Caixa de Entrada renderiza o mesmo ConversationCard da lista de
// conversas, para as duas telas serem identicas por construcao. O store de
// notificacoes entrega a conversa em camelCase; o card le snake_case.
const conversationForCard = computed(() =>
  snakecaseKeys(primaryActor.value || {}, { deep: true })
);
const isUnread = computed(() => !props.inboxItem?.readAt);
// getInboxById devolve camelCase; o ChannelIcon le channel_type.
const inbox = computed(() =>
  snakecaseKeys(props.stateInbox || {}, { deep: true })
);

const menuItems = computed(() => [
  {
    key: isUnread.value ? 'mark_as_read' : 'mark_as_unread',
    icon: isUnread.value ? 'mail' : 'mail-unread',
    label: t(`INBOX.MENU_ITEM.MARK_AS_${isUnread.value ? 'READ' : 'UNREAD'}`),
  },
  { key: 'delete', icon: 'delete', label: t('INBOX.MENU_ITEM.DELETE') },
]);

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
  <div class="w-full" :class="isUnread ? 'bg-n-blue-2' : ''">
    <ConversationCard
      :chat="conversationForCard"
      :current-contact="conversationForCard.meta?.sender || {}"
      :assignee="conversationForCard.meta?.assignee || {}"
      :inbox="inbox"
      :is-active-chat="isActive"
      :selected="selected"
      show-inbox-name
      @select-conversation="emit('select', inboxItem.id)"
      @de-select-conversation="emit('deselect', inboxItem.id)"
      @click="emit('click')"
      @contextmenu="contextMenuActions.open($event)"
    />
    <InboxContextMenu
      v-if="isContextMenuOpen"
      :context-menu-position="contextMenuPosition"
      :menu-items="menuItems"
      @close="contextMenuActions.close"
      @select-action="contextMenuActions.handle"
    />
  </div>
</template>
