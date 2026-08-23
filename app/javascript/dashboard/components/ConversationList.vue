<script setup>
import { ref, computed, provide } from 'vue';
import { groupConsecutive } from 'dashboard/helper/groupConsecutive';
import { Virtualizer } from 'virtua/vue';
import { useBreakpoints } from '@vueuse/core';
import { useChatListKeyboardEvents } from 'dashboard/composables/chatlist/useChatListKeyboardEvents';
import ConversationItem from './ConversationItem.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';
import IntersectionObserver from 'dashboard/components/IntersectionObserver.vue';

import wootConstants from 'dashboard/constants/globals';

const props = defineProps({
  conversationList: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  showEndOfListMessage: { type: Boolean, default: false },
  label: { type: String, default: '' },
  teamId: { type: [String, Number], default: 0 },
  foldersId: { type: [String, Number], default: 0 },
  conversationType: { type: String, default: '' },
  showAssignee: { type: Boolean, default: false },
  isOnExpandedLayout: { type: Boolean, default: false },
});

const emit = defineEmits(['loadMore']);

const conversationListRef = ref(null);
const virtualListRef = ref(null);
const isContextMenuOpen = ref(false);

provide('contextMenuElementTarget', virtualListRef);

const breakpoints = useBreakpoints({
  lg: wootConstants.LARGE_SCREEN_BREAKPOINT,
});
const isLgScreen = breakpoints.greaterOrEqual('lg');
const showExpandedCards = computed(
  () => props.isOnExpandedLayout && isLgScreen.value
);

useChatListKeyboardEvents(conversationListRef);

const intersectionObserverOptions = computed(() => ({
  root: conversationListRef.value,
  rootMargin: '100px 0px 100px 0px',
}));

const onContextMenuToggle = state => {
  isContextMenuOpen.value = state;
};

const loadMoreConversations = () => {
  emit('loadMore');
};

provide('toggleContextMenu', onContextMenuToggle);

// Sequencias do mesmo remetente na mesma caixa (oito avisos seguidos do
// Railway, por exemplo) colapsam na mais recente, com um botao para abrir o
// resto. So agrupa itens consecutivos, entao a ordenacao por atividade se
// mantem.
const expandedGroups = ref(new Set());

const toggleGroup = key => {
  const next = new Set(expandedGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedGroups.value = next;
};

const displayList = computed(() =>
  groupConsecutive(
    props.conversationList,
    {
      keyOf: c => {
        const senderId = c?.meta?.sender?.id;
        return senderId ? `${senderId}-${c.inbox_id}` : null;
      },
      nameOf: c => c?.meta?.sender?.name || '',
    },
    expandedGroups.value
  )
);

defineExpose({ conversationListRef });
</script>

<template>
  <div
    ref="conversationListRef"
    class="flex-1 min-h-0 overflow-y-auto conversations-list"
    :class="{ '!overflow-hidden': isContextMenuOpen }"
  >
    <Virtualizer
      ref="virtualListRef"
      v-slot="{ item }"
      :data="displayList"
      class="[&>div:has(+_div_.active)>*]:!border-n-surface-1 [&>div:has(+_div_.selected)>*]:!border-n-surface-1"
    >
      <div>
        <ConversationItem
          :source="item.item"
          :label="label"
          :team-id="teamId"
          :folders-id="foldersId"
          :conversation-type="conversationType"
          :show-assignee="showAssignee"
          :show-expanded="showExpandedCards"
        />
        <button
          v-if="item.hiddenCount"
          class="w-full py-1 text-xs text-center cursor-pointer text-n-slate-11 hover:text-n-slate-12 bg-n-alpha-1 hover:bg-n-alpha-2"
          @click="toggleGroup(item.groupKey)"
        >
          {{
            $t('CHAT_LIST.GROUP.SHOW_MORE', {
              count: item.hiddenCount,
              name: item.senderName,
            })
          }}
        </button>
        <button
          v-else-if="item.collapseAfter"
          class="w-full py-1 text-xs text-center cursor-pointer text-n-slate-11 hover:text-n-slate-12 bg-n-alpha-1 hover:bg-n-alpha-2"
          @click="toggleGroup(item.groupKey)"
        >
          {{ $t('CHAT_LIST.GROUP.COLLAPSE') }}
        </button>
      </div>
    </Virtualizer>
    <div v-if="isLoading" class="flex justify-center my-4">
      <Spinner class="text-n-brand" />
    </div>
    <p v-else-if="showEndOfListMessage" class="p-4 text-center text-n-slate-11">
      {{ $t('CHAT_LIST.EOF') }}
    </p>
    <IntersectionObserver
      v-else
      :options="intersectionObserverOptions"
      @observed="loadMoreConversations"
    />
  </div>
</template>
