import { AbsAudioPlayer } from '@/plugins/capacitor'

export default {
  methods: {
    /**
     * Plays a book, preferring the downloaded copy. Tapping the book that is already loaded toggles play/pause.
     */
    async kidsPlay(libraryItem) {
      if (!libraryItem || this.$store.state.playerIsStartingPlayback) return
      await this.$hapticsImpact()

      const serverLibraryItemId = libraryItem.id
      const localLibraryItem = await this.$db.getLocalLibraryItemByLId(serverLibraryItemId).catch(() => null)
      const libraryItemId = localLibraryItem && !this.$store.state.isCasting ? localLibraryItem.id : serverLibraryItemId

      if (this.$store.getters['getIsMediaStreaming'](libraryItemId, null)) {
        await AbsAudioPlayer.playPause()
        return
      }

      this.$store.commit('setPlayerIsStartingPlayback', libraryItemId)
      this.$eventBus.$emit('play-item', { libraryItemId, serverLibraryItemId })
    }
  }
}
