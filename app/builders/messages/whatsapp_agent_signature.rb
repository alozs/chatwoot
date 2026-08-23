# Numa caixa de WhatsApp via ponte (Channel::Api com nome de WhatsApp), o
# numero e compartilhado: quem le nao sabe qual agente respondeu. Mensagem
# de agente sai assinada no formato do WhatsApp:
#
#   *Nome para exibicao*:
#   Texto enviado
class Messages::WhatsappAgentSignature
  pattr_initialize :content, :user, :conversation, :private_note, :message_type

  def call
    return content unless applicable?

    "*#{display_name}*:\n#{content}"
  end

  private

  def applicable?
    content.present? && !private_note && message_type == 'outgoing' &&
      whatsapp_api_inbox? && user.is_a?(User) && display_name.present?
  end

  def display_name
    @display_name ||= user.try(:available_name).presence || user.try(:name)
  end

  def whatsapp_api_inbox?
    inbox = conversation.inbox
    inbox.channel.is_a?(Channel::Api) && inbox.name.match?(/whats\s*app/i)
  end
end
