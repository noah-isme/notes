import { readable } from 'svelte/store';

export const page = readable({
  url: new URL('http://localhost:5173/'),
  params: {},
  route: { id: null },
  status: 404,
  error: { message: 'Note is private or not found' },
  data: {},
  form: null,
});

export const navigating = readable(null);

export const updated = {
  subscribe: readable(false).subscribe,
  check: async () => false,
};

export const getStores = () => ({
  page,
  navigating,
  updated,
});
