<script lang="ts">
    import favicon from '$lib/assets/favicon.svg';
</script>

<!-- The band at the top of every screen: the app icon and the wordmark in ink,
     no controls. The icon is decoration, so the name stays "YouDemo". -->
<header
    data-section="header"
    class="flex h-16 shrink-0 items-center justify-between border-b-[1.5px] border-yd-ink bg-yd-base px-4 sm:px-6"
>
    <span class="flex items-center gap-3 text-wordmark text-yd-ink">
        <img
            src={favicon}
            alt=""
            width="32"
            height="32"
            aria-hidden="true"
            class="block shrink-0"
        />
        YouDemo
    </span>
</header>
