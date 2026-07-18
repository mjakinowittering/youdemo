<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import type { ComponentProps } from 'svelte';

    import ErrorScreen from '$lib/components/ErrorScreen.svelte';

    const { Story } = defineMeta({
        title: 'Components/ErrorScreen/ErrorScreen',
        component: ErrorScreen,
        tags: ['autodocs'],
        // Default template shared by every Story below (snippet defined in the markup).
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            error: 'Error: Something went wrong'
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof ErrorScreen>)}
    <div class="h-256 bg-background text-foreground">
        <ErrorScreen {...args} />
    </div>
{/snippet}

<Story name="Default" />

<Story
    name="With stack trace"
    args={{
        error: `RangeError: Maximum call stack size exceeded
    at drawFrame (recorder.ts:142:18)
    at composite (recorder.ts:98:5)
    at MediaRecorder.ondataavailable (recorder.ts:64:9)`
    }}
/>

<Story name="Empty error" args={{ error: '' }} />
