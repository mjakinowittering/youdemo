<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import type { ComponentProps } from 'svelte';

    import WelcomeModal from '$lib/components/WelcomeModal.svelte';

    const { Story } = defineMeta({
        title: 'Components/WelcomeModal/WelcomeModal',
        component: WelcomeModal,
        tags: ['autodocs'],
        // Default template shared by every Story below (snippet defined in the markup).
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        // The modal only opens when `ydWelcomed` is absent (first-visit gate), so
        // clear it before each render to reliably show the dialog in the story.
        beforeEach: () => {
            localStorage.removeItem('ydWelcomed');
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof WelcomeModal>)}
    <!--
        Scope the dialog to this box for the story:
        - `transform-gpu` makes the wrapper a containing block for the fixed overlay/content.
        - `portalProps.disabled` renders the dialog inline (not on <body>) so it lives here.
        - `interactOutsideBehavior`/`escapeKeydownBehavior` 'ignore' keep it open for inspection
          (bits-ui otherwise dismisses on any document-level click or Escape).
    -->
    <div class="h-256 transform-gpu bg-background text-foreground">
        <WelcomeModal
            {...args}
            contentProps={{
                portalProps: { disabled: true },
                interactOutsideBehavior: 'ignore',
                escapeKeydownBehavior: 'ignore'
            }}
        />
    </div>
{/snippet}

<Story name="Default" />
