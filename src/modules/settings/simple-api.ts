import { Core } from 'src/core'
import { getRandomInt } from 'src/utils/random'
import { addSettings } from './index'
import { SettingsBuilder } from './SettingsBuilder'
import { PageBuilder } from './PageBuilder'

/**
 * Setting value types supported by the API
 */
export type SettingValueType = boolean | number | string | object

/**
 * Callback for when a setting changes
 */
export type SettingChangeCallback = (newValue: SettingValueType) => void

/**
 * Validator function to check if a value is valid
 */
export type SettingValidator = (value: SettingValueType) => boolean

/**
 * Manages a single setting's state and persistence
 */
class Setting {
  private _id: string
  private _key: string
  private _defaultValue: SettingValueType
  private _validator: SettingValidator
  private _listeners: SettingChangeCallback[]

  constructor(id: string, defaultValue: SettingValueType, validator?: SettingValidator) {
    this._id = id
    this._key = `upl_setting_${id}`
    this._defaultValue = defaultValue
    this._validator = validator || (() => true)
    this._listeners = []

    // Initialize with stored value or default
    this._load()
  }

  /**
   * Load the setting value from storage
   */
  private _load(): void {
    try {
      const storedValue = localStorage.getItem(this._key)
      if (storedValue !== null) {
        const value = JSON.parse(storedValue)
        if (this._validator(value)) {
          return // Successfully loaded
        }
      }
    } catch (e) {
      console.warn(`UPL: Failed to load setting ${this._id}`, e)
    }

    // If we got here, use default value
    this._save(this._defaultValue)
  }

  /**
   * Save the setting value to storage
   */
  private _save(value: SettingValueType): void {
    try {
      localStorage.setItem(this._key, JSON.stringify(value))
    } catch (e) {
      console.error(`UPL: Failed to save setting ${this._id}`, e)
    }
  }

  /**
   * Get the current value of the setting
   */
  getValue(): SettingValueType {
    const storedValue = localStorage.getItem(this._key)
    if (storedValue === null) {
      return this._defaultValue
    }

    try {
      const value = JSON.parse(storedValue)
      return this._validator(value) ? value : this._defaultValue
    } catch (e) {
      return this._defaultValue
    }
  }

  /**
   * Set a new value for the setting
   */
  setValue(value: SettingValueType): void {
    if (!this._validator(value)) {
      console.warn(`UPL: Invalid value for setting ${this._id}`)
      return
    }

    this._save(value)
    
    // Notify listeners
    for (const listener of this._listeners) {
      try {
        listener(value)
      } catch (e) {
        console.error(`UPL: Error in setting listener for ${this._id}`, e)
      }
    }
  }

  /**
   * Add a listener for value changes
   */
  addListener(callback: SettingChangeCallback): void {
    this._listeners.push(callback)
  }

  /**
   * Remove a listener
   */
  removeListener(callback: SettingChangeCallback): void {
    const index = this._listeners.indexOf(callback)
    if (index !== -1) {
      this._listeners.splice(index, 1)
    }
  }
}

/**
 * Registry that manages all settings
 */
class SettingsManager {
  private _settings: Map<string, Setting>

  constructor() {
    this._settings = new Map()
  }

  /**
   * Create a new boolean setting
   */
  createToggle(id: string, defaultValue: boolean = false): Setting {
    return this._createSetting(id, defaultValue, (value) => typeof value === 'boolean')
  }

  /**
   * Create a new number setting
   */
  createNumber(id: string, defaultValue: number = 0, min?: number, max?: number): Setting {
    return this._createSetting(id, defaultValue, (value) => {
      if (typeof value !== 'number') return false
      if (min !== undefined && value < min) return false
      if (max !== undefined && value > max) return false
      return true
    })
  }

  /**
   * Create a new string setting
   */
  createString(id: string, defaultValue: string = '', maxLength?: number): Setting {
    return this._createSetting(id, defaultValue, (value) => {
      if (typeof value !== 'string') return false
      if (maxLength !== undefined && value.length > maxLength) return false
      return true
    })
  }

  /**
   * Create a new select setting (from a list of options)
   */
  createSelect(id: string, options: string[], defaultValue: string): Setting {
    if (!options.includes(defaultValue)) {
      console.warn(`UPL: Default value "${defaultValue}" not in options for ${id}`)
      defaultValue = options[0] || ''
    }

    return this._createSetting(id, defaultValue, (value) => {
      return typeof value === 'string' && options.includes(value)
    })
  }

  /**
   * Create a custom setting
   */
  private _createSetting(id: string, defaultValue: SettingValueType, validator: SettingValidator): Setting {
    if (this._settings.has(id)) {
      console.warn(`UPL: Setting ${id} already exists, returning existing instance`)
      return this._settings.get(id)!
    }

    const setting = new Setting(id, defaultValue, validator)
    this._settings.set(id, setting)
    return setting
  }

  /**
   * Get an existing setting by ID
   */
  getSetting(id: string): Setting | undefined {
    return this._settings.get(id)
  }
}

// Single instance of the settings manager
const settingsManager = new SettingsManager()

/**
 * Settings UI configuration
 */
export interface SettingsUIConfig {
  title: string
  capitalTitle?: string
  position?: number
  categories: SettingsCategoryConfig[]
}

/**
 * Settings category configuration
 */
export interface SettingsCategoryConfig {
  title: string
  renderHTML: (element: Element) => void
}

/**
 * Register settings UI in the League client
 */
export function registerSettingsUI(config: SettingsUIConfig): void {
  if (Core === undefined) {
    throw new Error("UPL not initialized!")
  }

  addSettings(builder => {
    builder = builder.createGroup(config.title, group => {
      if (config.capitalTitle) {
        group.withCapitalTitle(config.capitalTitle)
      }
      
      for (const cat of config.categories) {
        group = group.createCategory(cat.title, category => {
          return category.withCallback(cat.renderHTML)
        })
      }
      
      return group
    })
    
    if (config.position !== undefined) {
      builder = builder.setStartIdx(config.position)
    }
    
    return builder
  })
}

/**
 * Create a boolean toggle setting
 */
export function createToggle(id: string, defaultValue: boolean = false): Setting {
  return settingsManager.createToggle(id, defaultValue)
}

/**
 * Create a number setting
 */
export function createNumber(id: string, defaultValue: number = 0, min?: number, max?: number): Setting {
  return settingsManager.createNumber(id, defaultValue, min, max)
}

/**
 * Create a string setting
 */
export function createString(id: string, defaultValue: string = '', maxLength?: number): Setting {
  return settingsManager.createString(id, defaultValue, maxLength)
}

/**
 * Create a select setting
 */
export function createSelect(id: string, options: string[], defaultValue: string): Setting {
  return settingsManager.createSelect(id, options, defaultValue)
}

/**
 * Get a setting by ID
 */
export function getSetting(id: string): Setting | undefined {
  return settingsManager.getSetting(id)
}

// Export the API
export default {
  createToggle,
  createNumber,
  createString,
  createSelect,
  getSetting,
  registerSettingsUI
}