from __future__ import annotations

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN

from homeassistant.core import callback
import voluptuous as vol

from .const import DOMAIN

class MacsOptionsFlowHandler(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Optional(
                    "enable_shape_extensions",
                    default=self.config_entry.options.get("enable_shape_extensions", False)
                ): bool,
            }),
        )


class MacsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return MacsOptionsFlowHandler(config_entry)

    async def async_step_user(self, user_input=None) -> FlowResult:
        # No options in V1; just create a single entry.
        # Check if an entry already exists, if so, abort.
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        
        return self.async_create_entry(title="Macs", data={})
