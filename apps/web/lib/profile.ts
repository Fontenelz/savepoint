import 'server-only';
import type { Profile } from '@savepoint/shared';
import { cache } from 'react';
import { apiOrNotFound } from './api';

/** O layout e as abas do perfil compartilham a mesma requisição. */
export const getProfile = cache((username: string) => apiOrNotFound<Profile>(`/users/${encodeURIComponent(username)}`));
