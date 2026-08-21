<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import WootSnackbar from './Snackbar.vue';
import { emitter } from 'shared/helpers/mitt';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  duration: {
    type: Number,
    default: 2500,
  },
});

const { t } = useI18n();

const snackMessages = ref([]);
const snackbarContainer = ref(null);

const showPopover = () => {
  try {
    const el = snackbarContainer.value;
    if (el?.matches(':popover-open')) {
      el.hidePopover();
    }
    el?.showPopover();
  } catch (e) {
    // ignore
  }
};

const onNewToastMessage = ({ message: originalMessage, action }) => {
  const message = action?.usei18n ? t(originalMessage) : originalMessage;
  const duration = action?.duration || props.duration;

  snackMessages.value.push({
    key: Date.now(),
    message,
    action,
  });

  nextTick(showPopover);

  setTimeout(() => {
    snackMessages.value.shift();
  }, duration);
};

onMounted(() => {
  emitter.on('newToastMessage', onNewToastMessage);
});

onUnmounted(() => {
  emitter.off('newToastMessage', onNewToastMessage);
});
</script>

<template>
  <div
    ref="snackbarContainer"
    popover="manual"
    class="fixed top-4 left-1/2 -translate-x-1/2 max-w-[25rem] w-[calc(100%-2rem)] text-center bg-transparent border-0 p-0 m-0 outline-none overflow-visible"
  >
    <transition-group name="toast-fade" tag="div">
      <WootSnackbar
        v-for="snackMessage in snackMessages"
        :key="snackMessage.key"
        :message="snackMessage.message"
        :action="snackMessage.action"
      />
    </transition-group>
  </div>
</template>

<style lang="scss">
// O transition-group ja usava o nome "toast-fade", mas o CSS nunca existiu:
// as notificacoes apareciam e sumiam num quadro so.
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition:
    opacity 180ms ease-out,
    transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

// Empurra os toasts restantes com suavidade quando um sai do meio da pilha.
.toast-fade-move {
  transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-fade-leave-active {
  position: absolute;
  inset-inline: 0;
}

@media (prefers-reduced-motion: reduce) {
  .toast-fade-enter-active,
  .toast-fade-leave-active,
  .toast-fade-move {
    transition: none;
  }
}
</style>
