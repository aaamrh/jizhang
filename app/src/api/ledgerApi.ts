import type { Invite, InvitePreview, RemoteLedger, RemoteMember } from '../types/api'
import type { FamilyFeed } from '../utils/familyFeed'
import { request } from './client'

export const listLedgers = () => request<RemoteLedger[]>('/api/ledgers')
/** shareFrom：家庭账本里，自己的账从哪天起汇进去（YYYY-MM-DD，不晚于今天） */
export const createLedger = (v: { id: string; name: string; type: 'personal' | 'book' | 'family'; cover?: string | null; shareFrom?: string }) =>
  request<RemoteLedger>('/api/ledgers', { method: 'POST', body: v })
export const updateLedger = (id: string, patch: { name?: string; cover?: string | null }) =>
  request<RemoteLedger>(`/api/ledgers/${id}`, { method: 'PATCH', body: patch })
export const dissolveLedger = (id: string) => request<void>(`/api/ledgers/${id}`, { method: 'DELETE' })
export const leaveLedger = (id: string) => request<void>(`/api/ledgers/${id}/leave`, { method: 'POST' })

export const updateMember = (ledgerId: string, memberId: string, patch: { nickname?: string; elderMode?: boolean }) =>
  request<RemoteMember>(`/api/ledgers/${ledgerId}/members/${memberId}`, { method: 'PATCH', body: patch })
export const removeMember = (ledgerId: string, memberId: string) =>
  request<void>(`/api/ledgers/${ledgerId}/members/${memberId}`, { method: 'DELETE' })

export const createInvite = (ledgerId: string) => request<Invite>(`/api/ledgers/${ledgerId}/invites`, { method: 'POST', body: { profileMemberId: null } })
export const listInvites = (ledgerId: string) => request<Invite[]>(`/api/ledgers/${ledgerId}/invites`)
export const revokeInvite = (ledgerId: string, code: string) => request<void>(`/api/ledgers/${ledgerId}/invites/${code}`, { method: 'DELETE' })
export const previewInvite = (code: string) => request<InvitePreview>(`/api/invites/${encodeURIComponent(code)}`)
export const acceptInvite = (code: string, shareFrom: string) =>
  request<RemoteLedger>(`/api/invites/${encodeURIComponent(code)}/accept`, { method: 'POST', body: { shareFrom } })

/** 家庭账本的汇总：一家人各自账本里、各自共享开始日期起记的账（[start, end) 按账目日期）。创建者大掌柜过期时，非创建者得到 403 family_inactive */
export const familyFeed = (ledgerId: string, start: string, end: string) =>
  request<FamilyFeed>(`/api/ledgers/${ledgerId}/family-feed?start=${start}&end=${end}`)
