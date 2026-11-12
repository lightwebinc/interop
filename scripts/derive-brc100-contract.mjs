import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
const root = path.resolve(import.meta.dirname, '..')
const ts = createRequire(path.join(root, 'synthesis/package.json'))('typescript')
const input = fs.readFileSync(process.argv[2] ?? path.join(root, 'out/native-conformance-20261109/brc100.md'))
const sha256 = createHash('sha256').update(input).digest('hex')
if (sha256 !== '537ab393c655195e8cd61897b00d6b187a36f17d930493f8af48430752064082') throw Error('BRC100 source differs from frozen standard')
const markdown = input.toString(), start = markdown.indexOf('```typescript\n') + 14
const source = ts.createSourceFile('0100.ts', markdown.slice(start, markdown.indexOf('\n```', start)), ts.ScriptTarget.Latest, true)
const offset = markdown.slice(0, start).split('\n').length - 1
const line = node => source.getLineAndCharacterOfPosition(node.getStart()).line + offset + 1
function shape(n) {
  if (ts.isTypeReferenceNode(n)) {
    const name = n.typeName.getText(source)
    if (name === 'Array') return { kind: 'array', item: shape(n.typeArguments[0]) }
    if (name === 'Record') return { kind: 'record', key: shape(n.typeArguments[0]), value: shape(n.typeArguments[1]) }
    return { kind: 'alias', name }
  }
  if (ts.isTypeLiteralNode(n)) return { kind: 'object', fields: Object.fromEntries(n.members.map(f => [f.name.getText(source), { ...shape(f.type), optional: !!f.questionToken, line: line(f) }])) }
  if (ts.isArrayTypeNode(n)) return { kind: 'array', item: shape(n.elementType) }
  if (ts.isTupleTypeNode(n)) return { kind: 'tuple', items: n.elements.map(shape) }
  if (ts.isUnionTypeNode(n)) return { kind: 'union', variants: n.types.map(shape) }
  if (ts.isLiteralTypeNode(n)) return { kind: 'literal', value: n.literal.kind === ts.SyntaxKind.TrueKeyword ? true : n.literal.kind === ts.SyntaxKind.FalseKeyword ? false : ts.isNumericLiteral(n.literal) ? Number(n.literal.text) : n.literal.text }
  const primitive = n.getText(source)
  if (['string', 'number', 'boolean'].includes(primitive)) return { kind: primitive }
  throw Error(`Unhandled type ${primitive}`)
}
const wallet = source.statements.find(n => ts.isInterfaceDeclaration(n) && n.name.text === 'Wallet')
if (!wallet || wallet.members.length !== 28) throw Error('Wallet method set differs')
const contract = { schema: 'tpnil-brc100-contract@2.0.0', source: { repository: 'bsv-blockchain/BRCs', commit: '39a643ff148a8dcd23ec08986a8ddeb7d5713743', path: 'wallet/0100.md', gitBlobSha: 'ec25ff75b7d5c584a892e52dbcef07dfae6d9747', sha256, bytes: input.length }, methods: Object.fromEntries(wallet.members.map(m => [m.name.getText(source), { line: line(m), input: shape(m.type.parameters[0].type), output: shape(m.type.type.typeArguments[0]) }])) }
const destination = path.join(root, 'programs/ISI-4/profiles/native-conformance-2.0.0/brc100-contract.json')
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, JSON.stringify(contract, null, 2) + '\n')
console.log(JSON.stringify({ methods: Object.keys(contract.methods).length, sourceSha256: sha256, destination }))
