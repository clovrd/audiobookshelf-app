import { Capacitor } from '@capacitor/core'
import { AbsAudioPlayer } from '@/plugins/capacitor'
import { getItemSeries } from '@/utils/kids'

export default {
  computed: {
    kidsSession() {
      return this.$store.state.currentPlaybackSession
    },
    kidsIsPlaying() {
      return this.$store.state.playerIsPlaying
    },
    kidsCoverSrc() {
      const session = this.kidsSession
      if (!session) return null
      const localCover = session.localLibraryItem?.coverContentUrl
      if (localCover) return Capacitor.convertFileSrc(localCover)
      if (session.libraryItem) return this.$store.getters['globals/getLibraryItemCoverSrc'](session.libraryItem, '/book_placeholder.jpg')
      return this.$store.getters['globals/getLibraryItemCoverSrcById'](session.libraryItemId, '/book_placeholder.jpg')
    },
    /** { id, name, sequence } of the current book */
    kidsSeries() {
      const session = this.kidsSession
      return session ? getItemSeries(session.libraryItem || session) : null
    },
    kidsSeriesName() {
      return this.kidsSeries?.name || this.kidsSession?.displayTitle || ''
    },
    kidsEpisodeTitle() {
      return this.kidsSession?.displayTitle || ''
    },
    kidsDuration() {
      return this.kidsSession?.duration || 0
    },
    kidsCurrentTime() {
      return this.$store.state.kids.currentTime
    },
    kidsRemaining() {
      return Math.max(0, this.kidsDuration - this.kidsCurrentTime)
    },
    kidsChapters() {
      return this.kidsSession?.chapters || []
    },
    kidsChapterIndex() {
      const time = this.kidsCurrentTime
      return this.kidsChapters.findIndex((chapter) => time >= chapter.start && time < chapter.end)
    },
    kidsSleepMinutes() {
      const remaining = this.$store.state.kids.sleepRemaining
      return remaining > 0 ? Math.ceil(remaining / 60) : 0
    },
    kidsJumpSeconds() {
      return this.$store.getters['getJumpBackwardsTime']
    }
  },
  methods: {
    kidsPlayPause() {
      this.$hapticsImpact()
      return AbsAudioPlayer.playPause()
    },
    kidsJumpBackward() {
      this.$hapticsImpact()
      return AbsAudioPlayer.seekBackward({ value: this.$store.getters['getJumpBackwardsTime'] })
    },
    kidsJumpForward() {
      this.$hapticsImpact()
      return AbsAudioPlayer.seekForward({ value: this.$store.getters['getJumpForwardTime'] })
    },
    /** Server library item id of the current playback, also for downloaded items */
    kidsCurrentItemId() {
      const session = this.kidsSession
      return session ? session.libraryItemId || session.localLibraryItem?.libraryItemId || null : null
    },
    kidsIsCurrent(libraryItemId) {
      return !!libraryItemId && this.kidsCurrentItemId() === libraryItemId
    },
    /**
     * Plays a book and opens the player. Prefers the downloaded copy, restarts finished books.
     * The book that is already loaded just continues.
     */
    async kidsPlay(libraryItem, { restart = false } = {}) {
      if (!libraryItem || this.$store.state.playerIsStartingPlayback) return
      await this.$hapticsImpact()
      this.$store.commit('kids/set', { playerOpen: true })

      if (this.kidsIsCurrent(libraryItem.id)) {
        if (!this.kidsIsPlaying) await AbsAudioPlayer.playPlayer()
        return
      }

      const serverLibraryItemId = libraryItem.id
      const localLibraryItem = await this.$db.getLocalLibraryItemByLId(serverLibraryItemId).catch(() => null)
      const libraryItemId = localLibraryItem && !this.$store.state.isCasting ? localLibraryItem.id : serverLibraryItemId

      this.$store.commit('setPlayerIsStartingPlayback', libraryItemId)
      this.$eventBus.$emit('play-item', { libraryItemId, serverLibraryItemId, startTime: restart ? 0 : undefined })
    }
  }
}
