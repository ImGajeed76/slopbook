<script lang="ts">
	import Markdown from 'svelte-exmarkdown';
	import type { Plugin } from 'svelte-exmarkdown/types';
	import remarkGfm from 'remark-gfm';
	import rehypeHighlight from 'rehype-highlight';

	interface Props {
		content: string;
		compact?: boolean;
	}

	let { content, compact = false }: Props = $props();

	const plugins: Plugin[] = [
		{ remarkPlugin: [remarkGfm] },
		{ rehypePlugin: [rehypeHighlight, { detect: true }] }
	];
</script>

<div
	class="prose max-w-none dark:prose-invert [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto {compact
		? 'prose-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
		: ''}"
>
	<Markdown md={content} {plugins} />
</div>
