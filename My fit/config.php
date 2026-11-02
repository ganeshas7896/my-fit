<?php
return [
    'database' => [
        'host' => getenv('MYFIT_DB_HOST') ?: 'sql302.infinityfree.com',
        'name' => getenv('MYFIT_DB_NAME') ?: 'if0_43327214_myfit',
        'charset' => 'utf8mb4',
        'username' => getenv('MYFIT_DB_USER') ?: 'if0_43327214',
        'password' => getenv('MYFIT_DB_PASSWORD') ?: 'myfit12345678',
    ],
];
