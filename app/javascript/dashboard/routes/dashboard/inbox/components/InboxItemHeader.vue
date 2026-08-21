<script>
import { mapGetters } from 'vuex';
import { useAlert, useTrack } from 'dashboard/composables';
import { getUnixTime } from 'date-fns';
import { CMD_SNOOZE_NOTIFICATION } from 'dashboard/helper/commandbar/events';
import wootConstants from 'dashboard/constants/globals';
import { findSnoozeTime } from 'dashboard/helper/snoozeHelpers';
import { INBOX_EVENTS } from 'dashboard/helper/AnalyticsHelper/events';
import PaginationButton from './PaginationButton.vue';
import CustomSnoozeModal from 'dashboard/components/CustomSnoozeModal.vue';
import { emitter } from 'shared/helpers/mitt';
import BackButton from 'dashboard/components/widgets/BackButton.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import DropdownMenu from 'dashboard/components-next/dropdown-menu/DropdownMenu.vue';

export default {
  components: {
    PaginationButton,
    NextButton,
    BackButton,
    CustomSnoozeModal,
    DropdownMenu,
  },
  props: {
    totalLength: {
      type: Number,
      default: 0,
    },
    currentIndex: {
      type: Number,
      default: 0,
    },
    activeNotification: {
      type: Object,
      default: null,
    },
  },
  emits: ['next', 'prev'],
  data() {
    return { showCustomSnoozeModal: false, showActionsDropdown: false };
  },
  computed: {
    ...mapGetters({ meta: 'notifications/getMeta' }),
    // Adiar e excluir moram no menu para o cabecalho respirar; a navegacao
    // entre notificacoes continua visivel, que e o que se usa a todo momento.
    actionMenuItems() {
      return [
        {
          label: this.$t('INBOX.ACTION_HEADER.SNOOZE'),
          value: 'snooze',
          action: 'snooze',
          icon: 'i-lucide-bell-minus',
        },
        {
          label: this.$t('INBOX.ACTION_HEADER.DELETE'),
          value: 'delete',
          action: 'delete',
          icon: 'i-lucide-trash-2',
        },
      ];
    },
  },
  mounted() {
    emitter.on(CMD_SNOOZE_NOTIFICATION, this.onCmdSnoozeNotification);
  },
  unmounted() {
    emitter.off(CMD_SNOOZE_NOTIFICATION, this.onCmdSnoozeNotification);
  },
  methods: {
    openSnoozeNotificationModal() {
      const ninja = document.querySelector('ninja-keys');
      ninja.open({ parent: 'snooze_notification' });
    },
    hideCustomSnoozeModal() {
      this.showCustomSnoozeModal = false;
    },
    async snoozeNotification(snoozedUntil) {
      try {
        await this.$store.dispatch('notifications/snooze', {
          id: this.activeNotification?.id,
          snoozedUntil,
        });

        useAlert(this.$t('INBOX.ALERTS.SNOOZE'));
      } catch (error) {
        // Silently fail without any change in the UI
      }
    },
    onCmdSnoozeNotification(snoozeType) {
      if (snoozeType === wootConstants.SNOOZE_OPTIONS.UNTIL_CUSTOM_TIME) {
        this.showCustomSnoozeModal = true;
      } else if (typeof snoozeType === 'number') {
        this.snoozeNotification(snoozeType);
      } else {
        const snoozedUntil = findSnoozeTime(snoozeType) || null;
        this.snoozeNotification(snoozedUntil);
      }
    },
    scheduleCustomSnooze(customSnoozeTime) {
      this.showCustomSnoozeModal = false;
      if (customSnoozeTime) {
        const snoozedUntil = getUnixTime(customSnoozeTime) || null;
        this.snoozeNotification(snoozedUntil);
      }
    },
    deleteNotification() {
      useTrack(INBOX_EVENTS.DELETE_NOTIFICATION);
      this.$store
        .dispatch('notifications/delete', {
          notification: this.activeNotification,
          unread_count: this.meta.unreadCount,
          count: this.meta.count,
        })
        .then(() => {
          useAlert(this.$t('INBOX.ALERTS.DELETE'));
        });
      this.$router.replace({ name: 'inbox_view' });
    },
    onClickNext() {
      this.$emit('next');
    },
    onClickPrev() {
      this.$emit('prev');
    },
    onActionMenuClick({ action }) {
      this.showActionsDropdown = false;
      if (action === 'snooze') this.openSnoozeNotificationModal();
      if (action === 'delete') this.deleteNotification();
    },
    onClickGoToInboxList() {
      this.$router.replace({ name: 'inbox_view' });
    },
  },
};
</script>

<template>
  <div
    class="flex items-center justify-between w-full gap-2 border-b px-3 h-12 rtl:border-r border-n-weak flex-shrink-0 bg-n-surface-1"
  >
    <div class="flex items-center gap-4">
      <BackButton
        compact
        :button-label="$t('INBOX.ACTION_HEADER.BACK')"
        class="xl:hidden flex"
      />
      <PaginationButton
        v-if="totalLength > 1"
        :total-length="totalLength"
        :current-index="currentIndex + 1"
        @next="onClickNext"
        @prev="onClickPrev"
      />
    </div>
    <div
      v-on-clickaway="() => (showActionsDropdown = false)"
      class="relative flex items-center group"
    >
      <NextButton
        v-tooltip="$t('CONVERSATION.HEADER.MORE_ACTIONS')"
        icon="i-lucide-more-vertical"
        slate
        xs
        faded
        class="rounded-md group-hover:bg-n-alpha-2"
        @click="showActionsDropdown = !showActionsDropdown"
      />
      <DropdownMenu
        v-if="showActionsDropdown"
        :menu-items="actionMenuItems"
        class="mt-1 ltr:right-0 rtl:left-0 top-full"
        @action="onActionMenuClick"
      />
    </div>
    <woot-modal
      v-model:show="showCustomSnoozeModal"
      :on-close="hideCustomSnoozeModal"
    >
      <CustomSnoozeModal
        @close="hideCustomSnoozeModal"
        @choose-time="scheduleCustomSnooze"
      />
    </woot-modal>
  </div>
</template>
