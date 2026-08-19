/**
 * Browser plugin contributing one entry to the conversation view slot. It
 * defines no service and reads no session state — the tab explains what an
 * exported Blueprint overlay does to this harness.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: the 'conversation.view' SlotMap row is declared by the slot's
// owning package and must be in the program for register to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { BlueprintView } from './BlueprintView.tsx'

/** Required service: the slot registry that owns the conversation view ring. */
export const inject = ['slots']

/**
 * Register the Harness Map tab. The registration rides the slot service's
 * effect wrapper, so unloading the plugin removes the tab.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'blueprint',
        order: 20,
        label: () => 'Blueprint',
      },
      BlueprintView,
    ),
  )
}
