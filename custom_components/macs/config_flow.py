from __future__ import annotations
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN

class MacsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Get the options flow for this handler."""
        return MacsOptionsFlow(config_entry)

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Handle a flow initiated by the user."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        
        return self.async_create_entry(title="MACS", data={})


class MacsOptionsFlow(config_entries.OptionsFlow):
    """Handle MACS options."""

    def __init__(self, config_entry: config_entries.ConfigEntry):
        """Initialize MACS options flow."""
        super().__init__(config_entry)

    async def async_step_init(self, user_input=None) -> FlowResult:
        """Manage the MACS options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "enable_shape_extensions",
                        default=self.config_entry.options.get("enable_shape_extensions", False),
                    ): bool
                }
            ),
        )
