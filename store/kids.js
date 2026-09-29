// State of the kids mode (pages/kids, components/kids), kept by components/kids/Shell.vue

export const state = () => ({
  playerOpen: false,
  // null | 'sleep' | 'light' | 'parent'
  sheet: null,
  // Seconds in the whole book, polled from the native player
  currentTime: 0,
  // Seconds remaining, 0 when no sleep timer is running
  sleepRemaining: 0,
  volumeStep: 0,
  volumeMaxStep: 15,
  // 0.05-1, applied natively to the app window
  brightness: 1,
  favoriteSeriesIds: [],
  // A parent left the kids mode, "/" goes to the normal UI until the app restarts
  parentExited: false
})

export const mutations = {
  set(state, values) {
    Object.assign(state, values)
  }
}
