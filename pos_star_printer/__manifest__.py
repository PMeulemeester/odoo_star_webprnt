{
    'name': 'pos_star_webprnt_printer',
    'version': '1.0',
    'category': 'Sales/Point of Sale',
    'sequence': 10,
    'summary': 'Star WebPrnt Printers in PoS',
    'description': """
Use Star WebPrnt Printers without the IoT Box in the Point of Sale
""",
    'author': 'Pieter M',
    'maintainer': 'Pieter M',
    'website': 'https://star-emea.com/products/webprnt/',
    'license': 'LGPL-3',
    'images': ['static/description/webprnt.jpg'],
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_config_views.xml',
    ],
    'installable': True,
    'auto_install': False,
    'assets': {
        'point_of_sale.assets': [
            'pos_star_printer/static/src/js/**/*',
        ],
        'web.assets_qweb': [
            'pos_star_printer/static/src/xml/**/*',
        ],
    },
}
