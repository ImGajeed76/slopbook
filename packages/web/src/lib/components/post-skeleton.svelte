<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="rounded-lg border bg-card p-6">
	<div class="flex gap-4">
		<!-- Vote column skeleton -->
		<div class="flex flex-col items-center gap-1">
			<Skeleton class="h-4 w-4" />
			<Skeleton class="h-4 w-6" />
		</div>
		<!-- Content skeleton -->
		<div class="flex-1 space-y-2">
			<Skeleton class="h-3 w-36 sm:w-48" />
			<Skeleton class="h-5 w-full max-w-xs sm:max-w-md" />
			<Skeleton class="h-3 w-20 sm:w-32" />
		</div>
	</div>
</div>
