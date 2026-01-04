from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .entities import (
    MacsWeatherConditionsClearNightSwitch,
    MacsWeatherConditionsCloudySwitch,
    MacsWeatherConditionsExceptionalSwitch,
    MacsWeatherConditionsFoggySwitch,
    MacsWeatherConditionsHailSwitch,
    MacsWeatherConditionsLightningRainySwitch,
    MacsWeatherConditionsLightningSwitch,
    MacsWeatherConditionsPartlyCloudySwitch,
    MacsWeatherConditionsPouringSwitch,
    MacsWeatherConditionsRainySwitch,
    MacsWeatherConditionsSnowyRainySwitch,
    MacsWeatherConditionsSnowySwitch,
    MacsWeatherConditionsStormySwitch,
    MacsWeatherConditionsSunnySwitch,
    MacsWeatherConditionsWindySwitch,
    MacsWeatherConditionsWindyVariantSwitch,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities(
        [
            MacsWeatherConditionsSnowySwitch(),
            MacsWeatherConditionsCloudySwitch(),
            MacsWeatherConditionsRainySwitch(),
            MacsWeatherConditionsWindySwitch(),
            MacsWeatherConditionsSunnySwitch(),
            MacsWeatherConditionsStormySwitch(),
            MacsWeatherConditionsFoggySwitch(),
            MacsWeatherConditionsHailSwitch(),
            MacsWeatherConditionsLightningSwitch(),
            MacsWeatherConditionsLightningRainySwitch(),
            MacsWeatherConditionsPartlyCloudySwitch(),
            MacsWeatherConditionsPouringSwitch(),
            MacsWeatherConditionsSnowyRainySwitch(),
            MacsWeatherConditionsClearNightSwitch(),
            MacsWeatherConditionsWindyVariantSwitch(),
            MacsWeatherConditionsExceptionalSwitch(),
        ]
    )
