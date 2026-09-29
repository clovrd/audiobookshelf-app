<template>
  <div class="k-episode" :class="{ 'k-episode--unavailable': !isAvailable }" role="button" @click="play">
    <div class="k-episode__cover k-press" :class="{ 'k-episode__cover--finished': isFinished && !isCurrent, 'k-episode__cover--current': isCurrent }">
      <img :src="coverSrc" loading="lazy" @error="kidsCoverError" />
      <div v-if="isCurrent" class="k-episode__eq"><kids-equalizer :playing="kidsIsPlaying" /></div>
    </div>
    <span v-if="sequence !== null" class="k-episode__number num">{{ sequence }}</span>
    <div class="k-episode__text">
      <p v-if="title" class="k-episode__title">{{ title }}</p>
      <div v-if="isInProgress" class="k-progress k-episode__progress"><div :style="{ width: progressPercent + '%' }" /></div>
      <p class="k-episode__time num">
        <span v-if="isDownloaded" class="material-symbols k-episode__downloaded" title="Geladen">download_done</span>
        {{ timeText }}
      </p>
    </div>
    <span v-if="isFinished" class="k-episode__done"><span class="material-symbols" style="font-size: 26px">check</span></span>

    <!-- Download: its own tap target, the rest of the tile plays -->
    <span v-if="downloadState" class="k-episode__action" @click.stop>
      <svg class="k-episode__ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="20" class="k-episode__ring-track" />
        <circle cx="24" cy="24" r="20" class="k-episode__ring-fill" :style="{ strokeDashoffset: 125.66 * (1 - downloadState.progress) }" />
      </svg>
      <span class="material-symbols k-pulse" style="font-size: 22px">arrow_downward</span>
    </span>
    <button v-else-if="!isDownloaded && kidsCanDownload" class="k-episode__action k-episode__download" aria-label="Laden" @click.stop="kidsDownload([libraryItem.id])">
      <span class="material-symbols" style="font-size: 28px">download</span>
    </button>
    <span v-else-if="!isAvailable" class="k-episode__action k-episode__offline" aria-label="Nicht geladen"><span class="material-symbols" style="font-size: 26px">cloud_off</span></span>
  </div>
</template>

<script>
import kidsPlayback from '@/mixins/kidsPlayback'
import { getEpisodeTitle, toMinutes } from '@/utils/kids'

export default {
  mixins: [kidsPlayback],
  props: {
    libraryItem: {
      type: Object,
      required: true
    },
    sequence: {
      type: Number,
      default: null
    },
    seriesName: {
      type: String,
      default: null
    }
  },
  computed: {
    title() {
      // Titles often repeat the series name and number, which would be all that fits
      const title = getEpisodeTitle(this.libraryItem, this.seriesName, this.sequence)
      return title || (this.sequence === null ? this.libraryItem.media?.metadata?.title || '' : '')
    },
    coverSrc() {
      return this.kidsCoverFor(this.libraryItem)
    },
    duration() {
      return this.libraryItem.media?.duration || 0
    },
    userProgress() {
      return this.kidsProgressOf(this.libraryItem.id)
    },
    isCurrent() {
      return this.kidsIsCurrent(this.libraryItem.id)
    },
    isDownloaded() {
      return !!this.kidsLocalItem(this.libraryItem.id)
    },
    isAvailable() {
      return this.kidsIsAvailable(this.libraryItem.id)
    },
    downloadState() {
      return this.kidsDownloadState(this.libraryItem.id)
    },
    isFinished() {
      return !!this.userProgress?.isFinished
    },
    currentTime() {
      return this.isCurrent ? this.kidsCurrentTime : this.userProgress?.currentTime || 0
    },
    isInProgress() {
      return !this.isFinished && this.currentTime > 0
    },
    progressPercent() {
      return this.duration ? Math.min(100, (this.currentTime / this.duration) * 100) : 0
    },
    timeText() {
      if (this.isInProgress) return `noch ${toMinutes(this.duration - this.currentTime)} Min.`
      return this.duration ? `${toMinutes(this.duration)} Min.` : ''
    }
  },
  methods: {
    play() {
      this.kidsPlay(this.libraryItem, { restart: this.isFinished && !this.isCurrent })
    }
  }
}
</script>

<style scoped>
.k-episode {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  min-width: 0;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-line);
  text-align: left;
  color: var(--color-ink);
}
.k-episode__cover {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-cool);
}
.k-episode__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.k-episode__cover--finished img {
  opacity: 0.55;
}
.k-episode__cover--current {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}
.k-episode__eq {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(13 26 22 / 0.5);
}
.k-episode__number {
  min-width: 48px;
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
}
.k-episode__text {
  flex: 1;
  min-width: 0;
}
.k-episode__title {
  font-size: 17px;
  line-height: 1.3;
  color: var(--color-ink-body);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.k-episode__progress {
  height: 8px;
  margin-top: 10px;
}
.k-episode__time {
  margin-top: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-ink-muted);
}
.k-episode__done {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-positive-bg);
  color: var(--color-positive);
  font-weight: 700;
}
/* Offline and not downloaded */
.k-episode--unavailable {
  cursor: default;
}
.k-episode--unavailable > :not(.k-episode__action) {
  opacity: 0.4;
}
.k-episode--unavailable .k-press:active {
  transform: none;
}
.k-episode__downloaded {
  font-size: 18px;
  vertical-align: -3px;
  margin-right: 2px;
  color: var(--color-positive);
}
.k-episode__action {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-ink);
}
.k-episode__download {
  background: var(--color-cool);
  transition: transform 140ms var(--ease);
}
.k-episode__download:active {
  transform: scale(0.94);
}
.k-episode__offline {
  color: var(--color-ink-muted);
}
.k-episode__ring {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}
.k-episode__ring circle {
  fill: none;
  stroke-width: 4;
}
.k-episode__ring-track {
  stroke: var(--color-cool);
}
.k-episode__ring-fill {
  stroke: var(--color-primary);
  stroke-linecap: round;
  stroke-dasharray: 125.66;
  transition: stroke-dashoffset 300ms linear;
}
</style>
