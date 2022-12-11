import { Context, Schema, Service } from 'koishi'

export const name = 'rasa-nlu'

export const using = ['http'] as const

export interface Config {
  basic: {
    endpoint: string
  }
  command: {
    enabled: boolean
  }
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    basic: Schema.object({
      endpoint: Schema.string()
        .required()
        .description('API 服务器地址，形如 http://127.0.0.1:5005。'),
    }),
  }).description('基础'),
  Schema.object({
    command: Schema.object({
      enabled: Schema.boolean().default(false).description('启用 nlu 指令。'),
    }),
  }).description('指令'),
])

declare module 'koishi' {
  interface Context {
    rasanlu: RasaNLU
  }
}

class RasaNLU extends Service {
  constructor(ctx: Context, config: Config) {
    super(ctx, 'rasanlu', true)
    this.#config = config
  }

  #config: Config

  parse(text: string): Promise<unknown> {
    let parsedEndpoint = this.#config.basic.endpoint
    if (parsedEndpoint.endsWith('/'))
      parsedEndpoint = parsedEndpoint.slice(0, parsedEndpoint.length - 1)

    return this.ctx.http.post(`${parsedEndpoint}/model/parse`, { text })
  }
}

export function apply(ctx: Context, config: Config) {
  ctx.plugin(RasaNLU, config)

  if (config.command.enabled) {
    ctx
      .command('nlu <text>', '识别文本意图', { authority: 2 })
      .action(async (_, text) => {
        const nluData = await ctx.rasanlu.parse(text)

        let result = ''

        if (hasIntent(nluData))
          result += `意图：${nluData.intent.name}\n置信度：${nluData.intent.confidence}\n`

        if (hasIntentRanking(nluData)) {
          const candidates = nluData.intent_ranking.slice(1)

          result += `备选意图：\n`

          for (const candidate of candidates)
            result += `意图：${candidate.name}\n置信度：${candidate.confidence}\n`
        }

        return result
      })
  }
}

function hasIntent(
  nlu: unknown
): nlu is { intent: { name: string; confidence: number } } {
  return (nlu as { intent: { name: string; confidence: number } }).intent
    .name as unknown as boolean
}

function hasIntentRanking(
  nlu: unknown
): nlu is { intent_ranking: { name: string; confidence: number }[] } {
  return (nlu as { intent_ranking: { name: string; confidence: number }[] })
    .intent_ranking.length as unknown as boolean
}
