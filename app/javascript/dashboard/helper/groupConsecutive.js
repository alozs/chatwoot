/**
 * Colapsa sequencias consecutivas de itens com a mesma chave (por exemplo,
 * oito avisos seguidos do mesmo remetente) no primeiro item da sequencia, com
 * a contagem dos escondidos. So agrupa consecutivos, entao a ordenacao da
 * lista original se mantem.
 *
 * Cada entrada devolvida tem `item` e, quando faz parte de um grupo:
 * - `hiddenCount` e `senderName` no item visivel de um grupo recolhido;
 * - `collapseAfter` no ultimo item de um grupo aberto.
 *
 * @param {Array} list
 * @param {{ keyOf: Function, nameOf: Function }} accessors
 * @param {Set} expanded chaves dos grupos abertos
 */
export const groupConsecutive = (list, { keyOf, nameOf }, expanded) => {
  const out = [];
  let i = 0;
  while (i < list.length) {
    const key = keyOf(list[i]);
    let j = i + 1;
    while (key && j < list.length && keyOf(list[j]) === key) {
      j += 1;
    }
    const size = j - i;
    if (size > 1 && !expanded.has(key)) {
      out.push({
        item: list[i],
        groupKey: key,
        hiddenCount: size - 1,
        senderName: nameOf(list[i]),
      });
    } else {
      for (let k = i; k < j; k += 1) {
        const isLastOfGroup = size > 1 && k === j - 1;
        out.push({
          item: list[k],
          groupKey: isLastOfGroup ? key : null,
          collapseAfter: isLastOfGroup,
        });
      }
    }
    i = j;
  }
  return out;
};
