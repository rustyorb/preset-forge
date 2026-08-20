/**
 * SillyTavern Quick Reply sets - the automation layer preset kits ship.
 * Schema verified against 1.18 extensions/quick-reply (QuickReplySet.toJSON /
 * QuickReply.toJSON). A QR's message is plain text or STScript (/commands).
 */

export interface QuickReply {
  id: number;
  icon: string;
  showLabel: boolean;
  label: string;
  title: string;
  message: string;
  contextList: unknown[];
  preventAutoExecute: boolean;
  isHidden: boolean;
  executeOnStartup: boolean;
  executeOnUser: boolean;
  executeOnAi: boolean;
  executeOnChatChange: boolean;
  executeOnGroupMemberDraft: boolean;
  executeOnNewChat: boolean;
  executeBeforeGeneration: boolean;
  automationId: string;
}

export interface QuickReplySet {
  version: 2;
  name: string;
  disableSend: boolean;
  placeBeforeInput: boolean;
  injectInput: boolean;
  qrList: QuickReply[];
  idIndex: number;
}

export function newQuickReply(id: number, partial: Partial<QuickReply> = {}): QuickReply {
  return {
    id,
    icon: '',
    showLabel: true,
    label: 'New QR',
    title: '',
    message: '',
    contextList: [],
    preventAutoExecute: true,
    isHidden: false,
    executeOnStartup: false,
    executeOnUser: false,
    executeOnAi: false,
    executeOnChatChange: false,
    executeOnGroupMemberDraft: false,
    executeOnNewChat: false,
    executeBeforeGeneration: false,
    automationId: '',
    ...partial,
  };
}

export function newQrSet(name = 'PresetForge QRs'): QuickReplySet {
  return {
    version: 2,
    name,
    disableSend: false,
    placeBeforeInput: false,
    injectInput: false,
    qrList: [],
    idIndex: 0,
  };
}

export function addQr(set: QuickReplySet, partial: Partial<QuickReply>): QuickReplySet {
  const id = set.idIndex + 1;
  return {
    ...set,
    idIndex: id,
    qrList: [...set.qrList, newQuickReply(id, partial)],
  };
}

/** Light sanity check on a QR message (full STScript parsing lives in ST). */
export function lintQrMessage(message: string): string | null {
  const t = message.trim();
  if (!t) return 'empty message';
  if (t.startsWith('/')) {
    // STScript: flag the classic mistake of unclosed {: :} closure blocks
    const open = (t.match(/\{:/g) ?? []).length;
    const close = (t.match(/:\}/g) ?? []).length;
    if (open !== close) return `unbalanced closure blocks ({: ${open} vs :} ${close})`;
  }
  return null;
}
