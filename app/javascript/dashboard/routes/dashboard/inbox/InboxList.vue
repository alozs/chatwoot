<script setup>
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import { groupConsecutive } from 'dashboard/helper/groupConsecutive';
import NextButton from 'dashboard/components-next/button/Button.vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import { useAlert, useTrack } from 'dashboard/composables';
import { useUISettings } from 'dashboard/composables/useUISettings';
import wootConstants from 'dashboard/constants/globals';
import { INBOX_EVENTS } from 'dashboard/helper/AnalyticsHelper/events';

import InboxCard from 'dashboard/components-next/Inbox/InboxCard.vue';
import InboxListHeader from './components/InboxListHeader.vue';
import IntersectionObserver from 'dashboard/components/IntersectionObserver.vue';
import CmdBarConversationSnooze from 'dashboard/routes/dashboard/commands/CmdBarConversationSnooze.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useStore();
const { uiSettings } = useUISettings();

const notificationList = ref(null);
const page = ref(1);
const status = ref('');
const type = ref('');
const sortOrder = ref(wootConstants.INBOX_SORT_BY.NEWEST);
const isInboxContextMenuOpen = ref(false);

const infiniteLoaderOptions = computed(() => ({
  root: notificationList.value,
  rootMargin: '100px 0px 100px 0px',
}));

const meta = useMapGetter('notifications/getMeta');
const uiFlags = useMapGetter('notifications/getUIFlags');
const records = useMapGetter('notifications/getFilteredNotificationsV4');
const inboxById = useMapGetter('inboxes/getInboxById');

const currentConversationId = computed(() => Number(route.params.id));

const inboxFilters = computed(() => ({
  page: page.value,
  status: status.value,
  type: type.value,
  sortOrder: sortOrder.value,
}));

const notifications = computed(() => {
  return records.value(inboxFilters.value);
});

const showEndOfList = computed(() => {
  return uiFlags.value.isAllNotificationsLoaded && !uiFlags.value.isFetching;
});

const showEmptyState = computed(() => {
  return !uiFlags.value.isFetching && !notifications.value.length;
});

// Mesmo agrupamento da lista de conversas: sequencias do mesmo remetente na
// mesma caixa colapsam na mais recente.
const expandedGroups = ref(new Set());
const toggleGroup = key => {
  const next = new Set(expandedGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedGroups.value = next;
};
const groupedNotifications = computed(() =>
  groupConsecutive(
    notifications.value,
    {
      keyOf: n => {
        const senderId = n?.primaryActor?.meta?.sender?.id;
        return senderId ? `${senderId}-${n.primaryActor?.inboxId}` : null;
      },
      nameOf: n => n?.primaryActor?.meta?.sender?.name || '',
    },
    expandedGroups.value
  )
);

const stateInbox = inboxId => {
  return inboxById.value(inboxId);
};

const fetchNotifications = () => {
  page.value = 1;
  store.dispatch('notifications/clear');
  const filter = inboxFilters.value;
  store.dispatch('notifications/index', filter);
};

const scrollActiveIntoView = () => {
  const activeEl = notificationList.value?.querySelector('.inbox-card.active');
  activeEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
};

const redirectToInbox = () => {
  if (route.name === 'inbox_view') return;
  router.replace({ name: 'inbox_view' });
};

// Selecao multipla: a checkbox que aparece ao passar o mouse no avatar e a
// mesma da lista de conversas. Aqui ela alimenta uma barra de acoes em massa.
const selectedIds = ref(new Set());
const selectedCount = computed(() => selectedIds.value.size);
const isSelected = id => selectedIds.value.has(id);
const selectNotification = id => {
  selectedIds.value = new Set([...selectedIds.value, id]);
};
const deselectNotification = id => {
  const next = new Set(selectedIds.value);
  next.delete(id);
  selectedIds.value = next;
};
const clearSelection = () => {
  selectedIds.value = new Set();
};
const selectedItems = () =>
  notifications.value.filter(n => selectedIds.value.has(n.id));

const bulkMarkAsRead = async () => {
  const items = selectedItems().filter(n => !n.readAt);
  await Promise.allSettled(
    items.map(n =>
      store.dispatch('notifications/read', {
        id: n.id,
        primaryActorId: n.primaryActorId,
        primaryActorType: n.primaryActorType,
        unreadCount: meta.value.unreadCount,
      })
    )
  );
  store.dispatch('notifications/unReadCount');
  clearSelection();
  useAlert(t('INBOX.BULK.MARKED_READ', { count: items.length }, items.length));
};

const bulkDelete = async () => {
  const items = selectedItems();
  redirectToInbox();
  await Promise.allSettled(
    items.map(n =>
      store.dispatch('notifications/delete', {
        notification: n,
        unread_count: meta.value.unreadCount,
        count: meta.value.count,
      })
    )
  );
  store.dispatch('notifications/unReadCount');
  clearSelection();
  useAlert(t('INBOX.BULK.DELETED', { count: items.length }, items.length));
};

const loadMoreNotifications = () => {
  if (uiFlags.value.isAllNotificationsLoaded) return;

  page.value += 1;
  store.dispatch('notifications/index', {
    page: page.value,
    status: status.value,
    type: type.value,
    sortOrder: sortOrder.value,
  });
};

const markNotificationAsRead = async notificationItem => {
  useTrack(INBOX_EVENTS.MARK_NOTIFICATION_AS_READ);

  const { id, primaryActorId, primaryActorType } = notificationItem;
  try {
    await store.dispatch('notifications/read', {
      id,
      primaryActorId,
      primaryActorType,
      unreadCount: meta.value.unreadCount,
    });

    useAlert(t('INBOX.ALERTS.MARK_AS_READ'));
    store.dispatch('notifications/unReadCount');
  } catch {
    // error
  }
};

const markNotificationAsUnRead = async notificationItem => {
  useTrack(INBOX_EVENTS.MARK_NOTIFICATION_AS_UNREAD);
  redirectToInbox();

  const { id } = notificationItem;

  try {
    await store.dispatch('notifications/unread', { id });
    useAlert(t('INBOX.ALERTS.MARK_AS_UNREAD'));
    store.dispatch('notifications/unReadCount');
  } catch {
    // error
  }
};

const deleteNotification = async notificationItem => {
  useTrack(INBOX_EVENTS.DELETE_NOTIFICATION);
  redirectToInbox();

  try {
    await store.dispatch('notifications/delete', {
      notification: notificationItem,
      unread_count: meta.value.unreadCount,
      count: meta.value.count,
    });

    useAlert(t('INBOX.ALERTS.DELETE'));
  } catch {
    // error
  }
};

const onFilterChange = option => {
  const { STATUS, TYPE, SORT_ORDER } = wootConstants.INBOX_FILTER_TYPE;
  if (option.type === STATUS) {
    status.value = option.selected ? option.key : '';
  }
  if (option.type === TYPE) {
    type.value = option.selected ? option.key : '';
  }
  if (option.type === SORT_ORDER) {
    sortOrder.value = option.key;
  }
  fetchNotifications();
};

const setSavedFilter = () => {
  const { inbox_filter_by: filterBy = {} } = uiSettings.value;
  const { status: savedStatus, type: savedType, sort_by: sortBy } = filterBy;
  status.value = savedStatus;
  type.value = savedType;
  sortOrder.value = sortBy || wootConstants.INBOX_SORT_BY.NEWEST;
  store.dispatch('notifications/setNotificationFilters', inboxFilters.value);
};

const openConversation = async notificationItem => {
  const {
    id,
    primaryActorId,
    primaryActorType,
    primaryActor: { inboxId, id: conversationId },
    notificationType,
  } = notificationItem;

  if (route.params.id === String(conversationId)) return;

  useTrack(INBOX_EVENTS.OPEN_CONVERSATION_VIA_INBOX, {
    notificationType,
  });

  try {
    await store.dispatch('notifications/read', {
      id,
      primaryActorId,
      primaryActorType,
      unreadCount: meta.value.unreadCount,
    });

    // to update the unread count in the store realtime
    store.dispatch('notifications/unReadCount');

    router.push({
      name: 'inbox_view_conversation',
      params: { inboxId, type: 'conversation', id: conversationId },
    });
  } catch {
    // error
  }
};

watch(
  inboxFilters,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      store.dispatch('notifications/updateNotificationFilters', newVal);
    }
  },
  { deep: true }
);

watch(currentConversationId, () => {
  nextTick(scrollActiveIntoView);
});

onMounted(() => {
  scrollActiveIntoView();
  setSavedFilter();
  fetchNotifications();
});
</script>

<template>
  <section class="flex w-full h-full min-w-0 bg-n-surface-1">
    <div
      class="flex flex-col h-full w-full lg:min-w-[340px] lg:max-w-[340px] ltr:border-r rtl:border-l border-n-weak"
      :class="!currentConversationId ? 'flex' : 'hidden xl:flex'"
    >
      <InboxListHeader
        :is-context-menu-open="isInboxContextMenuOpen"
        @filter="onFilterChange"
        @redirect="redirectToInbox"
      />
      <div
        v-if="selectedCount"
        class="flex items-center gap-1 px-3 py-1.5 text-xs border-b border-n-weak bg-n-solid-1"
      >
        <span class="font-medium truncate text-n-slate-12 tabular-nums">
          {{
            $t('INBOX.BULK.SELECTED', { count: selectedCount }, selectedCount)
          }}
        </span>
        <div class="flex items-center gap-0.5 ltr:ml-auto rtl:mr-auto">
          <NextButton
            v-tooltip.bottom="$t('INBOX.BULK.MARK_READ')"
            icon="i-lucide-check-check"
            ghost
            xs
            slate
            @click="bulkMarkAsRead"
          />
          <NextButton
            v-tooltip.bottom="$t('INBOX.BULK.DELETE')"
            icon="i-lucide-trash-2"
            ghost
            xs
            class="!text-n-ruby-11"
            @click="bulkDelete"
          />
          <NextButton
            v-tooltip.bottom="$t('INBOX.BULK.CLEAR')"
            icon="i-lucide-x"
            ghost
            xs
            slate
            @click="clearSelection"
          />
        </div>
      </div>
      <div
        ref="notificationList"
        class="flex flex-col w-full pb-4 overflow-x-hidden overflow-y-auto"
        :class="selectedCount ? 'h-[calc(100%-96px)]' : 'h-[calc(100%-56px)]'"
      >
        <template v-for="entry in groupedNotifications" :key="entry.item.id">
          <InboxCard
            :inbox-item="entry.item"
            :state-inbox="stateInbox(entry.item.primaryActor?.inboxId)"
            :is-active="currentConversationId === entry.item.primaryActor?.id"
            :selected="isSelected(entry.item.id)"
            class="inbox-card"
            @select="selectNotification"
            @deselect="deselectNotification"
            @mark-notification-as-read="markNotificationAsRead"
            @mark-notification-as-un-read="markNotificationAsUnRead"
            @delete-notification="deleteNotification"
            @context-menu-open="isInboxContextMenuOpen = true"
            @context-menu-close="isInboxContextMenuOpen = false"
            @click="openConversation(entry.item)"
          />
          <button
            v-if="entry.hiddenCount"
            class="w-full py-1 text-xs text-center cursor-pointer text-n-slate-11 hover:text-n-slate-12 bg-n-alpha-1 hover:bg-n-alpha-2"
            @click="toggleGroup(entry.groupKey)"
          >
            {{
              $t('CHAT_LIST.GROUP.SHOW_MORE', {
                count: entry.hiddenCount,
                name: entry.senderName,
              })
            }}
          </button>
          <button
            v-else-if="entry.collapseAfter"
            class="w-full py-1 text-xs text-center cursor-pointer text-n-slate-11 hover:text-n-slate-12 bg-n-alpha-1 hover:bg-n-alpha-2"
            @click="toggleGroup(entry.groupKey)"
          >
            {{ $t('CHAT_LIST.GROUP.COLLAPSE') }}
          </button>
        </template>
        <div v-if="uiFlags.isFetching" class="flex justify-center my-4">
          <Spinner class="text-n-brand" />
        </div>
        <p
          v-if="showEmptyState"
          class="p-4 text-sm font-medium text-center text-n-slate-10"
        >
          {{ $t('INBOX.LIST.NO_NOTIFICATIONS') }}
        </p>
        <IntersectionObserver
          v-if="!showEndOfList && !uiFlags.isFetching"
          :options="infiniteLoaderOptions"
          @observed="loadMoreNotifications"
        />
      </div>
    </div>
    <router-view />
    <CmdBarConversationSnooze />
  </section>
</template>
