<script>
import { mapGetters } from 'vuex';
import { useAlert, useTrack } from 'dashboard/composables';
import { getUnixTime } from 'date-fns';
import {
  CMD_SNOOZE_NOTIFICATION,
  CMD_DELETE_NOTIFICATION,
} from 'dashboard/helper/commandbar/events';
import wootConstants from 'dashboard/constants/globals';
import { findSnoozeTime } from 'dashboard/helper/snoozeHelpers';
import { INBOX_EVENTS } from 'dashboard/helper/AnalyticsHelper/events';
import CustomSnoozeModal from 'dashboard/components/CustomSnoozeModal.vue';
import { emitter } from 'shared/helpers/mitt';

export default {
  components: {
    CustomSnoozeModal,
  },
  props: {
    activeNotification: {
      type: Object,
      default: null,
    },
  },
  data() {
    return { showCustomSnoozeModal: false };
  },
  computed: {
    ...mapGetters({ meta: 'notifications/getMeta' }),
  },
  mounted() {
    emitter.on(CMD_SNOOZE_NOTIFICATION, this.onCmdSnoozeNotification);
    emitter.on(CMD_DELETE_NOTIFICATION, this.deleteNotification);
  },
  unmounted() {
    emitter.off(CMD_SNOOZE_NOTIFICATION, this.onCmdSnoozeNotification);
    emitter.off(CMD_DELETE_NOTIFICATION, this.deleteNotification);
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
    onClickGoToInboxList() {
      this.$router.replace({ name: 'inbox_view' });
    },
  },
};
</script>

<template>
  <woot-modal
    v-model:show="showCustomSnoozeModal"
    :on-close="hideCustomSnoozeModal"
  >
    <CustomSnoozeModal
      @close="hideCustomSnoozeModal"
      @choose-time="scheduleCustomSnooze"
    />
  </woot-modal>
</template>
