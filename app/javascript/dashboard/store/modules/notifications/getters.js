import { sortComparator } from './helpers';
import camelcaseKeys from 'camelcase-keys';

export const getters = {
  getFilteredNotifications: $state => filters => {
    const sortOrder = filters.sortOrder === 'desc' ? 'newest' : 'oldest';
    const sortedNotifications = Object.values($state.records).sort((n1, n2) =>
      sortComparator(n1, n2, sortOrder)
    );
    return sortedNotifications;
  },
  getFilteredNotificationsV4: $state => filters => {
    const sortOrder = filters.sortOrder === 'desc' ? 'newest' : 'oldest';
    // O backend so devolve lidas e adiadas quando o filtro inclui 'read' ou
    // 'snoozed'. Replicar a regra aqui faz a lista reagir na hora: ao abrir
    // uma notificacao ela some, sem esperar o proximo fetch.
    const includes = [filters.status, filters.type].filter(Boolean);
    const showRead = includes.includes('read');
    const showSnoozed = includes.includes('snoozed');
    const visible = Object.values($state.records).filter(n => {
      if (!showRead && n.read_at) return false;
      if (!showSnoozed && n.snoozed_until) return false;
      return true;
    });
    const sortedNotifications = visible.sort((n1, n2) =>
      sortComparator(n1, n2, sortOrder)
    );
    return camelcaseKeys(sortedNotifications, { deep: true });
  },
  getNotificationById: $state => id => {
    return $state.records[id] || {};
  },
  getUIFlags($state) {
    return $state.uiFlags;
  },
  getNotification: $state => id => {
    const notification = $state.records[id];
    return notification || {};
  },
  getMeta: $state => {
    return $state.meta;
  },
  getNotificationFilters($state) {
    return $state.notificationFilters;
  },
  getHasUnreadNotifications: $state => {
    return $state.meta.unreadCount > 0;
  },
  getUnreadCount: $state => {
    return $state.meta.unreadCount;
  },
};
