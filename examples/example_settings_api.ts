import * as upl from '../dist/index'
import settingsAPI from '../src/modules/settings/simple-api'

export function init(context: any) {
  // Initialize UPL context
  upl.init(context)

  // Create settings
  const enableFeature = settingsAPI.createToggle('enable_feature', true)
  const cooldownTime = settingsAPI.createNumber('cooldown_time', 5, 1, 10)
  const userName = settingsAPI.createString('user_name', 'Summoner', 20)
  const theme = settingsAPI.createSelect('theme', ['default', 'dark', 'light'], 'default')

  // Add change listener
  enableFeature.addListener((value) => {
    console.log(`Feature ${value ? 'enabled' : 'disabled'}`)
    // Perform actions based on the feature toggle
  })

  // Register settings UI
  settingsAPI.registerSettingsUI({
    title: 'My Plugin',
    capitalTitle: 'MY PLUGIN',
    position: 1, // Insert after the first group in settings
    categories: [
      {
        title: 'General Settings',
        renderHTML: (element: Element) => {
          // Create the settings UI
          const container = document.createElement('div')
          container.className = 'my-plugin-settings'
          
          // Create a toggle for the feature
          const featureToggle = document.createElement('div')
          featureToggle.className = 'setting-row'
          
          const toggleLabel = document.createElement('span')
          toggleLabel.textContent = 'Enable Feature'
          
          const toggle = document.createElement('lol-uikit-switch')
          toggle.setAttribute('data-checked', enableFeature.getValue() ? 'true' : 'false')
          toggle.addEventListener('change', () => {
            const newValue = toggle.getAttribute('data-checked') === 'true'
            enableFeature.setValue(newValue)
          })
          
          featureToggle.appendChild(toggleLabel)
          featureToggle.appendChild(toggle)
          container.appendChild(featureToggle)
          
          // Create a slider for cooldown time
          const cooldownRow = document.createElement('div')
          cooldownRow.className = 'setting-row'
          
          const cooldownLabel = document.createElement('span')
          cooldownLabel.textContent = 'Cooldown Time (seconds)'
          
          const cooldownSlider = document.createElement('lol-uikit-slider')
          cooldownSlider.setAttribute('min', '1')
          cooldownSlider.setAttribute('max', '10')
          cooldownSlider.setAttribute('value', cooldownTime.getValue().toString())
          cooldownSlider.addEventListener('change', (e: any) => {
            const newValue = parseInt(e.target.value, 10)
            cooldownTime.setValue(newValue)
          })
          
          cooldownRow.appendChild(cooldownLabel)
          cooldownRow.appendChild(cooldownSlider)
          container.appendChild(cooldownRow)
          
          // Add the settings container to the element
          element.appendChild(container)
        }
      },
      {
        title: 'Appearance',
        renderHTML: (element: Element) => {
          const container = document.createElement('div')
          container.className = 'my-plugin-appearance'
          
          // Create a dropdown for theme selection
          const themeRow = document.createElement('div')
          themeRow.className = 'setting-row'
          
          const themeLabel = document.createElement('span')
          themeLabel.textContent = 'Theme'
          
          const themeSelect = document.createElement('lol-uikit-dropdown')
          const options = ['default', 'dark', 'light']
          
          for (const option of options) {
            const optionEl = document.createElement('lol-uikit-dropdown-option')
            optionEl.setAttribute('value', option)
            optionEl.textContent = option.charAt(0).toUpperCase() + option.slice(1)
            themeSelect.appendChild(optionEl)
          }
          
          themeSelect.setAttribute('selected-value', theme.getValue().toString())
          themeSelect.addEventListener('change', (e: any) => {
            theme.setValue(e.target.value)
          })
          
          themeRow.appendChild(themeLabel)
          themeRow.appendChild(themeSelect)
          container.appendChild(themeRow)
          
          // Create a text input for user name
          const nameRow = document.createElement('div')
          nameRow.className = 'setting-row'
          
          const nameLabel = document.createElement('span')
          nameLabel.textContent = 'Display Name'
          
          const nameInput = document.createElement('lol-uikit-flat-input')
          nameInput.setAttribute('value', userName.getValue().toString())
          nameInput.addEventListener('change', (e: any) => {
            userName.setValue(e.target.value)
          })
          
          nameRow.appendChild(nameLabel)
          nameRow.appendChild(nameInput)
          container.appendChild(nameRow)
          
          // Add the appearance container to the element
          element.appendChild(container)
        }
      }
    ]
  })
  
  // You can get and set settings values in your code
  console.log('Current cooldown time:', cooldownTime.getValue())
  
  // Change a setting value programmatically
  if (enableFeature.getValue() === true) {
    cooldownTime.setValue(7)
  }
}