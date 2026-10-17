<script lang="ts">
    import { ArrowLeft01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
    import { Button } from '$lib/components/ui/button/index.js';

    import { cn } from '$lib/utils.js';

    interface Props {
        /** Joining and exporting: both actions wait. */
        disabled?: boolean;
        /** Trim mode hides New recording. */
        trimming?: boolean;
        onback: () => void;
        onnewrecording: () => void;
        class?: string;
    }

    let {
        disabled = false,
        trimming = false,
        onback,
        onnewrecording,
        class: className
    }: Props = $props();
</script>

<Breadcrumb.Root
    data-section="breadcrumb"
    class={cn('flex h-14 shrink-0 items-center gap-3 bg-yd-base px-6', className)}
>
    <Breadcrumb.List class="flex-nowrap gap-3 text-small text-yd-muted sm:gap-3">
        <Breadcrumb.Item class="gap-3">
            <Button variant="link" {disabled} onclick={onback}>
                <Icon icon={ArrowLeft01Icon} size={18} />Back to review
            </Button>
        </Breadcrumb.Item>
        <Breadcrumb.Separator>/</Breadcrumb.Separator>
        <Breadcrumb.Item>
            <Breadcrumb.Page class="font-semibold text-yd-ink">Edit</Breadcrumb.Page>
        </Breadcrumb.Item>
    </Breadcrumb.List>
    <span class="flex-1"></span>
    {#if !trimming}
        <Button variant="ghost" {disabled} onclick={onnewrecording}>
            <Icon icon={PlusSignIcon} size={18} />New recording
        </Button>
    {/if}
</Breadcrumb.Root>
