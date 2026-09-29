# Bugfix Requirements Document

## Introduction

Dua bug ditemukan pada fitur Pengaturan Template Nota Dinas:

1. **Komponen `NotaDinasTemplateManagement`** (ditampilkan di tab "Template Nota" pada halaman Maintenance) tidak memiliki guard akses dan menampilkan dropdown wilayah, padahal seharusnya hanya dapat diakses oleh super admin dan dikunci ke template global (`regionId = null`) tanpa pilihan wilayah.

2. **Halaman `/nota-dinas/template`** (`NotaDinasTemplate.tsx`) mengunci super admin ke `regionId = null` (global) saja, padahal super admin seharusnya bisa memilih wilayah mana yang ingin diedit — termasuk wilayah tertentu atau global. Role non-super-admin tetap harus dikunci ke wilayah mereka sendiri.

Kedua bug ini menyebabkan inkonsistensi kontrol akses: komponen di Maintenance terlalu permisif (tidak ada pembatasan), sementara halaman standalone terlalu restriktif untuk super admin (tidak bisa memilih wilayah).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN pengguna dengan peran apapun (termasuk bukan super admin) membuka tab "Template Nota" di halaman Maintenance THEN the system menampilkan komponen `NotaDinasTemplateManagement` secara penuh tanpa pemeriksaan hak akses

1.2 WHEN komponen `NotaDinasTemplateManagement` ditampilkan di tab Maintenance THEN the system menampilkan dropdown pilihan wilayah yang memungkinkan pengguna mengubah template untuk wilayah manapun, termasuk global

1.3 WHEN super admin membuka halaman `/nota-dinas/template` THEN the system mengunci super admin ke `regionId = null` (global) saja karena kondisi `isRegionalAdmin && !isSuperAdmin` selalu false untuk super admin, sehingga tidak ada cara bagi super admin untuk memilih dan mengedit template per wilayah tertentu

### Expected Behavior (Correct)

2.1 WHEN pengguna yang bukan super admin membuka tab "Template Nota" di halaman Maintenance THEN the system SHALL menampilkan pesan akses ditolak atau tidak merender komponen `NotaDinasTemplateManagement`

2.2 WHEN komponen `NotaDinasTemplateManagement` ditampilkan di tab Maintenance THEN the system SHALL mengunci `regionId` ke `null` (global) dan tidak menampilkan dropdown pilihan wilayah, sehingga hanya template global yang dapat dikelola dari sini

2.3 WHEN super admin membuka halaman `/nota-dinas/template` THEN the system SHALL menampilkan dropdown pilihan wilayah (termasuk opsi "Default Global") sehingga super admin dapat memilih wilayah mana yang ingin diedit templatenya

### Unchanged Behavior (Regression Prevention)

3.1 WHEN pengguna dengan peran `admin_nota_dinas` membuka halaman `/nota-dinas/template` THEN the system SHALL CONTINUE TO mengunci tampilan ke wilayah milik pengguna (`profile.region_id`) tanpa dropdown pilihan wilayah

3.2 WHEN pengguna bukan super admin dan bukan `admin_nota_dinas` mengakses halaman `/nota-dinas/template` THEN the system SHALL CONTINUE TO menampilkan pesan akses ditolak

3.3 WHEN super admin membuka tab "Template Nota" di halaman Maintenance (setelah perbaikan) THEN the system SHALL CONTINUE TO dapat membuat, mengedit, dan menghapus template global (`regionId = null`)

3.4 WHEN `notaDinasTemplateService.save()` dipanggil dengan data template yang valid THEN the system SHALL CONTINUE TO menyimpan data ke database dengan benar tanpa perubahan pada layer service

3.5 WHEN pengguna `admin_nota_dinas` menyimpan atau menghapus template dari halaman `/nota-dinas/template` THEN the system SHALL CONTINUE TO membatasi operasi hanya pada template dengan `regionId` yang sama dengan `profile.region_id` pengguna
