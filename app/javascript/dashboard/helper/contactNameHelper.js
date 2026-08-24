// Pontes de WhatsApp (WAHA, Evolution) criam o contato com o JID como nome
// (ex.: 5519987710425@c.us). Para exibicao vale o telefone do contato — ou os
// digitos do proprio JID quando o telefone ainda nao foi preenchido.
const WHATSAPP_JID_PATTERN = /^(\d+)@(c\.us|s\.whatsapp\.net)$/i;

export const contactDisplayName = contact => {
  const name = contact?.name ?? '';
  const match = WHATSAPP_JID_PATTERN.exec(name.trim());
  if (!match) return name;
  return contact.phone_number || `+${match[1]}`;
};
