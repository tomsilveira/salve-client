import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';
import { loadAuth } from './lib/stores';

loadAuth();

mount(App, {
  target: document.getElementById('app'),
});
