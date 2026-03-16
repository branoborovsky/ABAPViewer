*&---------------------------------------------------------------------*
*& Report ZABAP_EXPORT_TO_ZIP
*&---------------------------------------------------------------------*
*& Export ABAP objects to ZIP for ABAP Viewer
*&---------------------------------------------------------------------*
REPORT zabap_export_to_zip.

TYPES: BEGIN OF ty_parameter,
         name        TYPE string,
         type        TYPE string,
         optional    TYPE abap_bool,
         description TYPE string,
       END OF ty_parameter,
       tt_parameter TYPE STANDARD TABLE OF ty_parameter WITH EMPTY KEY.

TYPES: BEGIN OF ty_parameters,
         importing TYPE tt_parameter,
         exporting TYPE tt_parameter,
         changing  TYPE tt_parameter,
         tables    TYPE tt_parameter,
       END OF ty_parameters.

TYPES: BEGIN OF ty_sub_object,
         name        TYPE string,
         type        TYPE string,
         description TYPE string,
         source      TYPE string,
         parameters  TYPE ty_parameters,
       END OF ty_sub_object,
       tt_sub_object TYPE STANDARD TABLE OF ty_sub_object WITH EMPTY KEY.

TYPES: BEGIN OF ty_field,
         name        TYPE string,
         key         TYPE abap_bool,
         type        TYPE string,
         length      TYPE string,
         description TYPE string,
       END OF ty_field,
       tt_field TYPE STANDARD TABLE OF ty_field WITH EMPTY KEY.

TYPES: BEGIN OF ty_attribute,
         name       TYPE string,
         visibility TYPE string,
         type       TYPE string,
       END OF ty_attribute,
       tt_attribute TYPE STANDARD TABLE OF ty_attribute WITH EMPTY KEY.

TYPES: BEGIN OF ty_method,
         name        TYPE string,
         visibility  TYPE string,
         description TYPE string,
       END OF ty_method,
       tt_method TYPE STANDARD TABLE OF ty_method WITH EMPTY KEY.

TYPES: BEGIN OF ty_components,
         attributes TYPE tt_attribute,
         methods    TYPE tt_method,
       END OF ty_components.

TYPES: BEGIN OF ty_abap_object,
         system         TYPE string,
         package        TYPE string,
         object_type    TYPE string,
         name           TYPE string,
         description    TYPE string,
         source         TYPE string,
         definition     TYPE string,
         implementation TYPE string,
         sub_objects    TYPE tt_sub_object,
         fields         TYPE tt_field,
         components     TYPE ty_components,
       END OF ty_abap_object,
       tt_abap_object TYPE STANDARD TABLE OF ty_abap_object WITH EMPTY KEY.

TABLES: tadir.

SELECT-OPTIONS: s_pkg FOR tadir-devclass DEFAULT 'ZCUSTOM'.
PARAMETERS: p_file TYPE string DEFAULT 'C:\TEMP\ABAP_EXPORT.ZIP'.

*&---------------------------------------------------------------------*
*& Tento program slúži na export zdrojových kódov SAP objektov
*& do formátu ZIP, ktorý je kompatibilný s týmto prehliadačom.
*&---------------------------------------------------------------------*

START-OF-SELECTION.
  WRITE: / 'Exporting package(s) to:', p_file.
  WRITE: / '---------------------------------------------------'.
  WRITE: / '1. Spustite tento program v SAP GUI (SE38)'.
  WRITE: / '2. Vyberte balíčky (Packages), ktoré chcete exportovať'.
  WRITE: / '3. Program vygeneruje ZIP súbor na vašom disku'.
  WRITE: / '4. Výsledný súbor nahrajte do ABAP Viewer aplikácie'.
  WRITE: / '---------------------------------------------------'.
  WRITE: / 'Poznámka: Pre plnú funkčnosť použite oficiálny exportný program'.
  WRITE: / 'dostupný v dokumentácii projektu.'.

*&---------------------------------------------------------------------*
*& Príklad naplnenia dát (pre inšpiráciu pri vývoji vlastného exportu)
*&---------------------------------------------------------------------*
* DATA: lt_objects TYPE tt_abap_object,
*       ls_object  TYPE ty_abap_object.
*
* ls_object-system      = sy-sysid.
* ls_object-package     = 'Z_DEMO'.
* ls_object-object_type = 'PROG'.
* ls_object-name        = 'Z_MY_REPORT'.
* ls_object-source      = 'REPORT z_my_report...'.
* APPEND ls_object TO lt_objects.
*
* DATA(lv_json) = /ui2/cl_json=>serialize( 
*   data          = lt_objects 
*   pretty_name   = /ui2/cl_json=>pretty_mode-camel_case ).
