<script setup>
import { computed } from 'vue';
import ChannelIcon from 'dashboard/components-next/icon/ChannelIcon.vue';
import { INBOX_TYPES } from 'dashboard/helper/inbox';

const props = defineProps({
  inbox: {
    type: Object,
    default: () => {},
  },
});

// O icone de marca (WhatsApp, Gmail...) ja vem colorido e ignora a cor do
// texto; a classe so alcanca os glifos monocromaticos de fallback, onde o
// e-mail sem provedor ganha azul para se distinguir dos outros canais.
const iconColorClass = computed(() =>
  props.inbox?.channel_type === INBOX_TYPES.EMAIL
    ? 'text-n-blue-11'
    : 'text-n-slate-11'
);
</script>

<template>
  <div :title="inbox.name" class="flex items-center gap-0.5 min-w-0">
    <ChannelIcon
      :inbox="inbox"
      use-brand-icon
      class="size-4 flex-shrink-0"
      :class="iconColorClass"
    />
    <span class="truncate text-label-small text-n-slate-11">
      {{ inbox.name }}
    </span>
  </div>
</template>
