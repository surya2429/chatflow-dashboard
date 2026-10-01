// Background handlers must be registered at module scope before the app
// mounts: Android runs this bundle headlessly (no UI) when a data-only push
// arrives for an incoming call, and the task has to exist by then.
import './src/background'
import 'expo-router/entry'
