# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class PosConfig(models.Model):
    _inherit = 'pos.config'

    star_printer_ip = fields.Char(string='Star Printer IP', help="Local IP address of a Star receipt printer.")

    @api.onchange('star_printer_ip')
    def _onchange_star_printer_ip(self):
        if self.star_printer_ip in (False, ''):
            self.iface_cashdrawer = False
