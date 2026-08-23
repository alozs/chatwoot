<script>
import { mapGetters } from 'vuex';
import { useAdmin } from 'dashboard/composables/useAdmin';
import { useAccount } from 'dashboard/composables/useAccount';
import OnboardingView from '../OnboardingView.vue';
import EmptyStateMessage from './EmptyStateMessage.vue';

export default {
  components: {
    OnboardingView,
    EmptyStateMessage,
  },
  props: {
    isOnExpandedLayout: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const { isAdmin } = useAdmin();

    const { accountScopedUrl } = useAccount();

    return {
      isAdmin,
      accountScopedUrl,
    };
  },
  computed: {
    ...mapGetters({
      currentChat: 'getSelectedChat',
      allConversations: 'getAllConversations',
      inboxesList: 'inboxes/getInboxes',
      uiFlags: 'inboxes/getUIFlags',
      loadingChatList: 'getChatListLoadingStatus',
      conversationStats: 'conversationStats/getStats',
    }),
    // Resumo do dia no lugar do espaco morto: o estado vazio e a tela mais
    // vista do painel, entao mostra o que ha para fazer.
    summaryItems() {
      const {
        mineCount = 0,
        unAssignedCount = 0,
        allCount = 0,
      } = this.conversationStats || {};
      return [
        { label: this.$t('CONVERSATION.SUMMARY.MINE'), value: mineCount },
        {
          label: this.$t('CONVERSATION.SUMMARY.UNASSIGNED'),
          value: unAssignedCount,
        },
        { label: this.$t('CONVERSATION.SUMMARY.ALL'), value: allCount },
      ];
    },
    loadingIndicatorMessage() {
      if (this.uiFlags.isFetching) {
        return this.$t('CONVERSATION.LOADING_INBOXES');
      }
      return this.$t('CONVERSATION.LOADING_CONVERSATIONS');
    },
    conversationMissingMessage() {
      if (!this.isOnExpandedLayout) {
        return this.$t('CONVERSATION.SELECT_A_CONVERSATION');
      }
      return this.$t('CONVERSATION.404');
    },
    newInboxURL() {
      return this.accountScopedUrl('settings/inboxes/new');
    },
    emptyClassName() {
      if (
        !this.inboxesList.length &&
        !this.uiFlags.isFetching &&
        !this.loadingChatList &&
        this.isAdmin
      ) {
        return 'h-full overflow-auto w-full';
      }
      return 'flex-1 min-w-0 px-0 flex flex-col items-center justify-center h-full bg-n-surface-1';
    },
  },
};
</script>

<template>
  <div :class="emptyClassName">
    <woot-loading-state
      v-if="uiFlags.isFetching || loadingChatList"
      :message="loadingIndicatorMessage"
    />
    <!-- No inboxes attached -->
    <div
      v-if="!inboxesList.length && !uiFlags.isFetching && !loadingChatList"
      class="clearfix mx-auto"
    >
      <OnboardingView v-if="isAdmin" />
      <EmptyStateMessage v-else :message="$t('CONVERSATION.NO_INBOX_AGENT')" />
    </div>
    <!-- Show empty state images if not loading -->

    <div
      v-else-if="!uiFlags.isFetching && !loadingChatList"
      class="flex flex-col items-center justify-center h-full"
    >
      <!-- No conversations available -->
      <EmptyStateMessage
        v-if="!allConversations.length"
        :message="$t('CONVERSATION.NO_MESSAGE_1')"
      />
      <template v-else-if="allConversations.length && !currentChat.id">
        <EmptyStateMessage :message="conversationMissingMessage" />
        <div class="flex items-center gap-6 mt-6">
          <div
            v-for="item in summaryItems"
            :key="item.label"
            class="flex flex-col items-center gap-0.5 min-w-16"
          >
            <span
              class="text-xl font-semibold text-n-slate-12 tabular-nums leading-6"
            >
              {{ item.value }}
            </span>
            <span class="text-xs text-n-slate-10">{{ item.label }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
