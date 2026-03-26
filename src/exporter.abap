*&---------------------------------------------------------------------*
*& Report  ZBB_DOWNLOADER
*&
*&---------------------------------------------------------------------*
*&
*&
*&---------------------------------------------------------------------*
REPORT zbb_downloader.

TABLES: tadir, enlfdir, d010inc, trdir, tfdir.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE text-001.
PARAMETERS: p_devcl TYPE tadir-devclass DEFAULT '$ZBB',
            p_path  TYPE string DEFAULT 'C:\temp\sample.zip'.
SELECTION-SCREEN END OF BLOCK b1.

DATA: go_zip      TYPE REF TO cl_abap_zip,
      lv_tmp_xstr TYPE xstring,
      i_tadir     TYPE STANDARD TABLE OF tadir,
      s_tadir     LIKE LINE OF i_tadir,
      lt_source   TYPE STANDARD TABLE OF abaptxt255.

TYPES: BEGIN OF ty_parameter,
         name        TYPE string,
         type        TYPE string,
         optional    TYPE abap_bool,
         description TYPE string,
       END OF ty_parameter.

TYPES: tt_parameters TYPE STANDARD TABLE OF ty_parameter WITH DEFAULT KEY.

TYPES: BEGIN OF ty_method_parameters,
         importing  TYPE tt_parameters,
         exporting  TYPE tt_parameters,
         changing   TYPE tt_parameters,
         returning  TYPE tt_parameters,
         tables     TYPE tt_parameters,
         exceptions TYPE tt_parameters,
       END OF ty_method_parameters.

TYPES: BEGIN OF ty_method,
         name        TYPE string,
         visibility  TYPE string,
         description TYPE string,
         parameters  TYPE ty_method_parameters,
         source      TYPE string,
       END OF ty_method.

TYPES: tt_methods TYPE STANDARD TABLE OF ty_method WITH DEFAULT KEY.

TYPES: BEGIN OF ty_attribute,
         name        TYPE string,
         visibility  TYPE string,
         type        TYPE string,
         description TYPE string,
       END OF ty_attribute.

TYPES: tt_attributes TYPE STANDARD TABLE OF ty_attribute WITH DEFAULT KEY.

TYPES: BEGIN OF ty_components,
         attributes TYPE tt_attributes,
         methods    TYPE tt_methods,
       END OF ty_components.

TYPES: BEGIN OF ty_screen_element,
         name TYPE string,
         type TYPE string,
         text TYPE string,
         line TYPE i,
         col  TYPE i,
       END OF ty_screen_element.

TYPES: tt_screen_elements TYPE STANDARD TABLE OF ty_screen_element WITH DEFAULT KEY.

TYPES: BEGIN OF ty_sub_object,
         name        TYPE string,
         type        TYPE string,
         description TYPE string,
         source      TYPE string,
         flow_logic  TYPE string,
         elements    TYPE tt_screen_elements,
         parameters  TYPE ty_method_parameters,
       END OF ty_sub_object.

TYPES: tt_sub_objects TYPE STANDARD TABLE OF ty_sub_object WITH DEFAULT KEY.

TYPES: BEGIN OF ty_domain_value,
         value       TYPE string,
         description TYPE string,
       END OF ty_domain_value.

TYPES: tt_domain_values TYPE STANDARD TABLE OF ty_domain_value WITH DEFAULT KEY.

TYPES: BEGIN OF ty_dtel_labels,
         short   TYPE string,
         medium  TYPE string,
         long    TYPE string,
         heading TYPE string,
       END OF ty_dtel_labels.

TYPES: BEGIN OF ty_message,
         number TYPE string,
         text   TYPE string,
       END OF ty_message.

TYPES: tt_messages TYPE STANDARD TABLE OF ty_message WITH DEFAULT KEY.

TYPES: BEGIN OF ty_table_ref,
         name  TYPE string,
         alias TYPE string,
       END OF ty_table_ref.

TYPES: tt_table_refs TYPE STANDARD TABLE OF ty_table_ref WITH DEFAULT KEY.

TYPES: BEGIN OF ty_field_ref,
         name       TYPE string,
         table      TYPE string,
         field_name TYPE string,
         lock       TYPE abap_bool,
       END OF ty_field_ref.

TYPES: tt_field_refs TYPE STANDARD TABLE OF ty_field_ref WITH DEFAULT KEY.

TYPES: BEGIN OF ty_table_field,
         name         TYPE string,
         key          TYPE abap_bool,
         data_element TYPE string,
         domain       TYPE string,
         type         TYPE string,
         length       TYPE i,
         decimals     TYPE i,
         description  TYPE string,
       END OF ty_table_field.

TYPES: tt_table_fields TYPE STANDARD TABLE OF ty_table_field WITH DEFAULT KEY.

* Method
TYPES: BEGIN OF tmethod,
         cmpname(61),
         descript    LIKE vseomethod-descript,
         exposure    LIKE vseomethod-exposure,
         methodkey   TYPE string,
       END OF tmethod.

* Interfaces
TYPES: BEGIN OF tinterface,
         interfacename LIKE vseoclass-clsname,
       END OF tinterface.

* Holds all domain texts
TYPES: BEGIN OF tdomainstructure,
         domname    TYPE domname,
         domvalue_l TYPE domvalue_l,
         domvalue_h TYPE domvalue_l,
         ddtext     TYPE val_text,
       END OF tdomainstructure.

* exception class texts
TYPES: BEGIN OF tconcept,
         constname TYPE string,
         concept   TYPE sotr_conc,
       END OF tconcept.

* Holds a table\structure definition
TYPES: BEGIN OF tdicttablestructure,
         fieldname LIKE dd03l-fieldname,
         position  LIKE dd03l-position,
         keyflag   LIKE dd03l-keyflag,
         rollname  LIKE dd03l-rollname,
         domname   LIKE dd03l-domname,
         datatype  LIKE dd03l-datatype,
         leng      LIKE dd03l-leng,
         lowercase TYPE lowercase,
         ddtext    LIKE dd04t-ddtext,
         idomains  TYPE tdomainstructure OCCURS 0,
       END OF tdicttablestructure.

TYPES: ttexttable LIKE textpool.
* GUI titles
TYPES: tguititle LIKE d347t.

* Message classes
TYPES: BEGIN OF tmessage,
         arbgb LIKE t100-arbgb,
         stext LIKE t100a-stext,
         msgnr LIKE t100-msgnr,
         text  LIKE t100-text,
       END OF tmessage.

* Screen flow.
TYPES: BEGIN OF tscreenflow,
         screen LIKE d020s-dnum,
         code   LIKE d022s-line,
       END OF tscreenflow.



*-- Holds a table type
TYPES: BEGIN OF ttabletype,
         typename   TYPE ttypename,  " Name of table type
         rowtype    TYPE ttrowtype,  " Name of row type for table types
         ttypkind   TYPE ttypkind,   " Category of table type (range or general table type)
         range_ctyp TYPE range_ctyp, " Elem. type of LOW and HIGH components of a Ranges type
         reftype    TYPE ddreftype,  " Type of Object Referenced
         occurs     TYPE ddoccurs,   " Initial Line Number for Table Types
         ddtext     TYPE ddtext,     " Description
       END OF ttabletype.

* Holds a tables attributes + its definition
TYPES: BEGIN OF tdicttable,
         tablename  LIKE dd03l-tabname,
         tabletitle LIKE dd02t-ddtext,
         istructure TYPE tdicttablestructure OCCURS 0,
       END OF tdicttable.

TYPES: BEGIN OF tdictfilename,
         tablename LIKE dd03l-tabname,
         filename  TYPE string,
       END OF tdictfilename.

TYPES: BEGIN OF ttransformation,
         xsltname LIKE trdir-name,
         xsltdesc LIKE tftit-stext,
         subc     LIKE trdir-subc,
       END OF ttransformation.

* Include program names
TYPES: BEGIN OF tinclude,
         includename  LIKE trdir-name,
         includetitle LIKE tftit-stext,
       END OF tinclude.

* Class
TYPES: BEGIN OF tclass,
         scanned(1),
         clsname           LIKE vseoclass-clsname,
         descript          LIKE vseoclass-descript,
         msg_id            LIKE vseoclass-msg_id,
         exposure          LIKE vseoclass-exposure,
         state             LIKE vseoclass-state,
         clsfinal          LIKE vseoclass-clsfinal,
         r3release         LIKE vseoclass-r3release,
         imethods          TYPE tmethod OCCURS 0,
         idictstruct       TYPE tdicttable OCCURS 0,
         itextelements     TYPE ttexttable OCCURS 0,
         imessages         TYPE tmessage OCCURS 0,
         iinterfaces       TYPE tinterface OCCURS 0,
         iconcepts         TYPE tconcept OCCURS 0,
         itabletypes       TYPE ttabletype OCCURS 0,
         itransformations  TYPE ttransformation OCCURS 0,
         textelementkey    TYPE string,
         publicclasskey    TYPE string,
         privateclasskey   TYPE string,
         protectedclasskey TYPE string,
         typesclasskey     TYPE string,
         exceptionclass    TYPE abap_bool,
       END OF tclass.

" Hlavná štruktúra pre SAP objekt
TYPES: BEGIN OF ty_main_object,
         system           TYPE string,
         package          TYPE string,
         object_type      TYPE string, " CLAS, PROG, atď.
         name             TYPE string,
         description      TYPE string,
         definition       TYPE string,
         implementation   TYPE string,
         source           TYPE string,
         encoding         TYPE string,
         flow_logic       TYPE string,
         components       TYPE ty_components,
         sub_objects      TYPE tt_sub_objects,
         " Doména / Tabuľka / Dátový prvok
         type             TYPE string,
         length           TYPE i,
         decimals         TYPE i,
         values           TYPE tt_domain_values,
         fields           TYPE tt_table_fields,
         " Dátový prvok
         domain           TYPE string,
         labels           TYPE ty_dtel_labels,
         " Tabuľkový typ
         line_type        TYPE string,
         access_mode      TYPE string,
         key_type         TYPE string,
         " Trieda správ
         messages         TYPE tt_messages,
         " Transakcia
         transaction_type TYPE string,
         program          TYPE string,
         screen           TYPE string,
         " Pohľad / Zámok
         view_type        TYPE string,
         lock_mode        TYPE string,
         tables           TYPE tt_table_refs,
         view_fields      TYPE tt_field_refs,
       END OF ty_main_object.

TYPES: tt_objects TYPE STANDARD TABLE OF ty_main_object WITH DEFAULT KEY.



* function modules
TYPES: BEGIN OF tfunction,
         functionname        LIKE tfdir-funcname,
         functiongroup       LIKE enlfdir-area,
         includenumber       LIKE tfdir-include,
         functionmaininclude LIKE tfdir-funcname,
         functiontitle       LIKE tftit-stext,
         topincludename      LIKE tfdir-funcname,
         progname            LIKE tfdir-pname,
         programlinkname     LIKE tfdir-pname,
         messageclass        LIKE t100-arbgb,
         itextelements       TYPE ttexttable OCCURS 0,
         iselectiontexts     TYPE ttexttable OCCURS 0,
         imessages           TYPE tmessage OCCURS 0,
         iincludes           TYPE tinclude OCCURS 0,
         idictstruct         TYPE tdicttable OCCURS 0,
         iguititle           TYPE tguititle OCCURS 0,
         iscreenflow         TYPE tscreenflow OCCURS 0,
         itabletypes         TYPE ttabletype OCCURS 0,
         itransformations    TYPE ttransformation OCCURS 0,
       END OF tfunction.


DATA: ifunctions TYPE STANDARD TABLE OF tfunction WITH HEADER LINE.
DATA: dumiincludes TYPE STANDARD TABLE OF tinclude.
DATA: s_object TYPE ty_main_object.

DATA: dumimethods TYPE STANDARD TABLE OF tmethod.

START-OF-SELECTION.
  CREATE OBJECT go_zip.

  SELECT * FROM tadir INTO TABLE i_tadir
    WHERE devclass = p_devcl.


END-OF-SELECTION.


  LOOP AT i_tadir INTO s_tadir.
    CLEAR: s_object.
    s_object-system = sy-sysid.
    s_object-package = p_devcl.
    CASE s_tadir-object.
      WHEN 'PROG'.
        PERFORM get_prog .
        PERFORM add_to_zip USING s_object.
      WHEN 'FUGR'.
        PERFORM get_fugr .
        PERFORM add_to_zip USING s_object.
      WHEN 'CLAS' OR 'INTF'.
        PERFORM get_class.
        PERFORM add_to_zip USING s_object.
      WHEN 'TABL'.
        PERFORM get_tab.
        PERFORM add_to_zip USING s_object.
      WHEN 'DOMA'.
        PERFORM get_doma.
        PERFORM add_to_zip USING s_object.
      WHEN 'DTEL'.
        PERFORM get_dtel.
        PERFORM add_to_zip USING s_object.
      WHEN 'TTYP'.
        PERFORM get_ttyp.
        PERFORM add_to_zip USING s_object.
      WHEN 'MSAG'.
        PERFORM get_msag.
        PERFORM add_to_zip USING s_object.
      WHEN 'TRAN'.
        PERFORM get_tran.
        PERFORM add_to_zip USING s_object.
      WHEN 'IATU'.
        PERFORM get_iatu.
        PERFORM add_to_zip USING s_object.
      WHEN 'XSLT'.
        PERFORM get_xslt.
        PERFORM add_to_zip USING s_object.
    ENDCASE.
  ENDLOOP.

  PERFORM download_zip.


**********************************************************************
* FORMS
**********************************************************************
*&---------------------------------------------------------------------*
*&      Form  GET_PROG
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_prog .
  DATA: ls_reposrc TYPE reposrc.
  DATA: lt_main_source TYPE STANDARD TABLE OF abaptxt255,
        lt_source      TYPE STANDARD TABLE OF abaptxt255,
        ls_source      TYPE abaptxt255.
  DATA: itokens TYPE STANDARD TABLE OF stokes WITH HEADER LINE.
  DATA: ikeywords TYPE STANDARD TABLE OF text20 WITH HEADER LINE.
  DATA: istatements TYPE STANDARD TABLE OF sstmnt WITH HEADER LINE.
  DATA: ls_subobjects LIKE LINE OF s_object-sub_objects.
  DATA: maxlines TYPE i.
  DATA: nextline TYPE i.
  DATA: castprogramname TYPE program.
  DATA: watokens TYPE stokes.
  DATA: l_progname TYPE reposrc-progname.
  DATA: header LIKE d020s.
  DATA: itexttable TYPE STANDARD TABLE OF ttexttable WITH HEADER LINE.
  DATA: watexts TYPE ttexttable.

  DEFINE add2source.
    CLEAR: ls_source.
    ls_source-line = &1.
    APPEND ls_source TO lt_main_source.
  END-OF-DEFINITION.

  SELECT SINGLE * INTO ls_reposrc
    FROM reposrc
    WHERE progname = s_tadir-obj_name
      AND subc IN ('1','I','M','S').

  CHECK sy-subrc = 0.

  READ REPORT s_tadir-obj_name INTO lt_main_source.

  CHECK sy-subrc = 0.

  s_object-object_type = 'PROG'.
  s_object-name = s_tadir-obj_name.
  PERFORM get_prog_desc USING s_tadir-obj_name CHANGING s_object-description.

  READ TEXTPOOL s_tadir-obj_name INTO itexttable LANGUAGE sy-langu.
  DELETE itexttable WHERE key = 'R'.

  IF NOT itexttable[] IS INITIAL.
    add2source: '*GUI Texts',
                '*----------------------------------------------------------'.
* Selection texts.
    LOOP AT itexttable.
      CLEAR: ls_source.
      ls_source-line(1) = '*'.
      ls_source-line+3 = itexttable-key.
      ls_source-line+15 = itexttable-entry.
      APPEND ls_source TO lt_main_source.
    ENDLOOP.
  ENDIF.

  PERFORM t2s USING lt_main_source CHANGING s_object-source.

  SCAN ABAP-SOURCE lt_main_source TOKENS INTO itokens WITH INCLUDES STATEMENTS INTO istatements KEYWORDS FROM ikeywords.

  maxlines = lines( itokens ).
  LOOP AT itokens WHERE str = 'INCLUDE' AND type = 'I'.
    nextline = sy-tabix + 1.
    IF nextline <= maxlines.
      READ TABLE itokens INDEX nextline INTO watokens.


      TRY.
          IF watokens-str+0(1) = 'Y' OR watokens-str+0(1) = 'Z' OR watokens-str+0(2) = 'MZ' OR watokens-str+0(2) = 'MY'.
          ELSE.
            CONTINUE.
          ENDIF.
        CATCH cx_sy_range_out_of_bounds.
      ENDTRY.


      CLEAR ls_subobjects.
      ls_subobjects-name = watokens-str.
      ls_subobjects-type = 'REPS'.
      l_progname = watokens-str.
      READ REPORT l_progname INTO lt_source.

      CHECK sy-subrc = 0.
      PERFORM t2s USING lt_source CHANGING ls_subobjects-source.

      PERFORM get_prog_desc USING l_progname CHANGING ls_subobjects-description.

      APPEND ls_subobjects TO s_object-sub_objects.

    ENDIF.
  ENDLOOP.

  DATA: iflow TYPE STANDARD TABLE OF tscreenflow WITH HEADER LINE.

  CLEAR: iflow.

  CALL FUNCTION 'DYNPRO_PROCESSINGLOGIC'
    EXPORTING
      rep_name  = s_tadir-obj_name
    TABLES
      scr_logic = iflow.

  SORT iflow ASCENDING BY screen.
  DELETE ADJACENT DUPLICATES FROM iflow COMPARING screen.
  IF ls_reposrc-subc <> 'M'.
    DELETE iflow WHERE screen >= '1000' AND screen <= '1099'.
  ENDIF.

  LOOP AT iflow.
    PERFORM get_screen USING ls_reposrc-progname iflow-screen.
  ENDLOOP.

ENDFORM.

*&---------------------------------------------------------------------*
*& Form ADD_TO_ZIP
*&---------------------------------------------------------------------*

FORM add_to_zip USING is_main TYPE ty_main_object.
  DATA: lv_json     TYPE string,
        lv_xstring  TYPE xstring,
        lv_filename TYPE string,
        lo_conv     TYPE REF TO cl_abap_conv_out_ce.

  CHECK NOT is_main-name IS INITIAL.
  CHECK NOT is_main-object_type IS INITIAL.

  " Použijeme vlastný serializátor namiesto chýbajúcej triedy
  PERFORM serialize_json USING is_main CHANGING lv_json.

  lo_conv = cl_abap_conv_out_ce=>create( encoding = 'UTF-8' ).
  lo_conv->convert( EXPORTING data = lv_json IMPORTING buffer = lv_xstring ).

  CONCATENATE is_main-object_type '_' is_main-name '.json' INTO lv_filename.
  go_zip->add( name = lv_filename content = lv_xstring ).

ENDFORM.                    "add_to_zip

*&---------------------------------------------------------------------*
*& Form DOWNLOAD_ZIP
*&---------------------------------------------------------------------*
FORM download_zip.
  DATA: lv_zip_content TYPE xstring,
        lt_data        TYPE TABLE OF x255,
        lv_len         TYPE i.
  DATA: l_filename TYPE string.

  l_filename = p_path.

  lv_zip_content = go_zip->save( ).

  CALL FUNCTION 'SCMS_XSTRING_TO_BINARY'
    EXPORTING
      buffer        = lv_zip_content
    IMPORTING
      output_length = lv_len
    TABLES
      binary_tab    = lt_data.

  CALL METHOD cl_gui_frontend_services=>gui_download
    EXPORTING
      bin_filesize = lv_len
      filename     = l_filename
      filetype     = 'BIN'
    CHANGING
      data_tab     = lt_data
    EXCEPTIONS
      OTHERS       = 1.

  IF sy-subrc = 0.
    MESSAGE 'Export dokončený.' TYPE 'S'.
  ENDIF.
ENDFORM.                    "download_zip

*&---------------------------------------------------------------------*
*& Form SERIALIZE_JSON
*&---------------------------------------------------------------------*
FORM serialize_json USING im_data TYPE any CHANGING ex_json TYPE string.
  DATA: lo_type TYPE REF TO cl_abap_typedescr.
  lo_type = cl_abap_typedescr=>describe_by_data( im_data ).

  CASE lo_type->kind.
    WHEN cl_abap_typedescr=>kind_elem.
      PERFORM serialize_elementary USING im_data CHANGING ex_json.
    WHEN cl_abap_typedescr=>kind_struct.
      PERFORM serialize_structure USING im_data CHANGING ex_json.
    WHEN cl_abap_typedescr=>kind_table.
      PERFORM serialize_table USING im_data CHANGING ex_json.
  ENDCASE.
ENDFORM.                    "serialize_json

*&---------------------------------------------------------------------*
*& Form SERIALIZE_ELEMENTARY
*&---------------------------------------------------------------------*
FORM serialize_elementary USING im_data TYPE any CHANGING ex_json TYPE string.
  DATA: lv_val  TYPE string,
        lo_elem TYPE REF TO cl_abap_elemdescr.

  lo_elem ?= cl_abap_typedescr=>describe_by_data( im_data ).

  CASE lo_elem->type_kind.
    WHEN cl_abap_typedescr=>typekind_int OR cl_abap_typedescr=>typekind_packed.
      lv_val = im_data.
      CONDENSE lv_val NO-GAPS.
      ex_json = lv_val.
    WHEN OTHERS.
      " Špeciálne ošetrenie pre Boolean (X -> true, ' ' -> false)
      IF lo_elem->length = 1 AND lo_elem->type_kind = cl_abap_typedescr=>typekind_char.
        IF im_data = 'X'.
          ex_json = 'true'.
        ELSEIF im_data = ' '.
          ex_json = 'false'.
        ELSE.
          lv_val = im_data.
          PERFORM escape_json_string USING lv_val CHANGING lv_val.
          CONCATENATE '"' lv_val '"' INTO ex_json.
        ENDIF.
      ELSE.
        lv_val = im_data.
        PERFORM escape_json_string USING lv_val CHANGING lv_val.
        CONCATENATE '"' lv_val '"' INTO ex_json.
      ENDIF.
  ENDCASE.
ENDFORM.                    "serialize_elementary

*&---------------------------------------------------------------------*
*& Form SERIALIZE_STRUCTURE
*&---------------------------------------------------------------------*
FORM serialize_structure USING im_data TYPE any CHANGING ex_json TYPE string.
  DATA: lo_struct TYPE REF TO cl_abap_structdescr,
        lt_comp   TYPE cl_abap_structdescr=>component_table,
        ls_comp   TYPE cl_abap_structdescr=>component,
        lv_sub    TYPE string,
        lv_name   TYPE string,
        lv_comma  TYPE char1.

  lo_struct ?= cl_abap_typedescr=>describe_by_data( im_data ).
  lt_comp = lo_struct->get_components( ).

  ex_json = '{'.
  LOOP AT lt_comp INTO ls_comp.
    FIELD-SYMBOLS: <fs_val> TYPE any.
    ASSIGN COMPONENT ls_comp-name OF STRUCTURE im_data TO <fs_val>.

    " Preskočiť prázdne tabuľky/hodnoty pre kompresiu (voliteľné)
    " IF <fs_val> IS INITIAL. CONTINUE. ENDIF.

    IF lv_comma = 'X'. CONCATENATE ex_json ',' INTO ex_json. ENDIF.

    PERFORM to_camel_case USING ls_comp-name CHANGING lv_name.
    PERFORM serialize_json USING <fs_val> CHANGING lv_sub.

    CONCATENATE ex_json '"' lv_name '":' lv_sub INTO ex_json.
    lv_comma = 'X'.
  ENDLOOP.
  CONCATENATE ex_json '}' INTO ex_json.
ENDFORM.                    "serialize_structure

*&---------------------------------------------------------------------*
*& Form SERIALIZE_TABLE
*&---------------------------------------------------------------------*
FORM serialize_table USING im_data TYPE ANY TABLE  CHANGING ex_json TYPE string.
  DATA: lv_sub   TYPE string,
        lv_comma TYPE char1.
  FIELD-SYMBOLS: <fs_row> TYPE any.

  ex_json = '['.
  LOOP AT im_data ASSIGNING <fs_row>.
    IF lv_comma = 'X'. CONCATENATE ex_json ',' INTO ex_json. ENDIF.
    PERFORM serialize_json USING <fs_row> CHANGING lv_sub.
    CONCATENATE ex_json lv_sub INTO ex_json.
    lv_comma = 'X'.
  ENDLOOP.
  CONCATENATE ex_json ']' INTO ex_json.
ENDFORM.                    "serialize_table

*&---------------------------------------------------------------------*
*& Form TO_CAMEL_CASE
*&---------------------------------------------------------------------*
FORM to_camel_case USING iv_name TYPE any CHANGING ev_name TYPE string.
  DATA: lt_parts TYPE TABLE OF text256,
        lv_part  TYPE text256,
        lv_idx   TYPE i,
        lv_tmp   TYPE string.

  lv_tmp = iv_name.
  TRANSLATE lv_tmp TO LOWER CASE.
  SPLIT lv_tmp AT '_' INTO TABLE lt_parts.

  CLEAR ev_name.
  LOOP AT lt_parts INTO lv_part.
    lv_idx = sy-tabix.
    IF lv_idx > 1.
      TRANSLATE lv_part+0(1) TO UPPER CASE.
    ENDIF.
    CONCATENATE ev_name lv_part INTO ev_name.
  ENDLOOP.
ENDFORM.                    "to_camel_case

*&---------------------------------------------------------------------*
*& Form ESCAPE_JSON_STRING
*&---------------------------------------------------------------------*
FORM escape_json_string USING iv_input TYPE string CHANGING ev_output TYPE string.
  ev_output = iv_input.
  REPLACE ALL OCCURRENCES OF '\' IN ev_output WITH '\\'.
  REPLACE ALL OCCURRENCES OF '"' IN ev_output WITH '\"'.
  REPLACE ALL OCCURRENCES OF '`' IN  ev_output WITH ''.
  REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>newline IN ev_output WITH '\n'.
  REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>cr_lf IN ev_output WITH '\n'.
  REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>horizontal_tab IN ev_output WITH '\t'.
ENDFORM.                    "escape_json_string
*&---------------------------------------------------------------------*
*&      Form  T2S
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*      -->P_LT_MAIN_SOURCE  text
*      <--P_S_OBJECT_SOURCE  text
*----------------------------------------------------------------------*
FORM t2s  USING    pt_tab TYPE abaptxt255_tab
          CHANGING p_src TYPE string.

  DATA: ls_tab LIKE LINE OF pt_tab.
  DATA: l_isline TYPE string.
  DATA: l_esline TYPE string.

  CLEAR: p_src.

  LOOP AT pt_tab INTO ls_tab.
    CLEAR: l_esline.
    l_isline = ls_tab-line.
*    PERFORM escape_json_string USING l_isline CHANGING l_esline.
    CONCATENATE p_src ls_tab-line INTO p_src SEPARATED BY cl_abap_char_utilities=>newline.
*    CONCATENATE p_src l_esline INTO p_src SEPARATED BY cl_abap_char_utilities=>newline.
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*&      Form  GET_PROG_DESC
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*      -->P_L_PROGNAME  text
*      <--P_LS_SUBOBJECTS_DESCRIPTION  text
*----------------------------------------------------------------------*
FORM get_prog_desc USING VALUE(programname)
                                           titletext.

  SELECT SINGLE text
              FROM trdirt
              INTO titletext
              WHERE name = programname
                AND sprsl = sy-langu.

ENDFORM.
*&---------------------------------------------------------------------*
*&      Form  GET_SCREEN
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*      -->P_LS_REPOSRC_NAME  text
*      -->P_IFLOW_SCREEN  text
*----------------------------------------------------------------------*
FORM get_screen  USING    p_report
                          p_screen.
  DATA: header LIKE d020s.
  DATA: ifields TYPE STANDARD TABLE OF d021s WITH HEADER LINE.
  DATA: iflowlogic TYPE STANDARD TABLE OF d022s WITH HEADER LINE.
  DATA: ls_d020s TYPE d020s.
  DATA: ls_subobjects LIKE LINE OF s_object-sub_objects,
        ls_elements   LIKE LINE OF ls_subobjects-elements.
  DATA: ifieldschar TYPE STANDARD TABLE OF scr_chfld WITH HEADER LINE.

  DATA: wacharheader TYPE scr_chhead.
  DATA: lt_source TYPE TABLE OF abaptxt255.


  ls_d020s-prog = p_report.
  ls_d020s-dnum = p_screen.

  CALL FUNCTION 'RS_IMPORT_DYNPRO'
    EXPORTING
      dylang        = sy-langu
      dyname        = ls_d020s-prog
      dynumb        = ls_d020s-dnum
    IMPORTING
      header        = header
    TABLES
      ftab          = ifields
      pltab         = iflowlogic
    EXCEPTIONS
      error_message = 1
      OTHERS        = 2.

  CHECK sy-subrc = 0.

  CALL FUNCTION 'RS_SCRP_HEADER_RAW_TO_CHAR'
    EXPORTING
      header_int  = header
    IMPORTING
      header_char = wacharheader
    EXCEPTIONS
      OTHERS      = 1.

  CLEAR ls_subobjects.
  ls_subobjects-name = p_screen.
  ls_subobjects-type = 'DYNP'.

  SELECT SINGLE dtxt FROM d020t INTO ls_subobjects-description
    WHERE prog = ls_d020s-prog
     AND dynr = ls_d020s-dnum
     AND lang = sy-langu.

  CLEAR: lt_source.
  LOOP AT iflowlogic.
    APPEND iflowlogic TO lt_source.
  ENDLOOP.

  PERFORM t2s USING lt_source CHANGING ls_subobjects-flow_logic.

  CALL FUNCTION 'RS_SCRP_FIELDS_RAW_TO_CHAR'
    TABLES
      fields_int  = ifields[]
      fields_char = ifieldschar[]
    EXCEPTIONS
      OTHERS      = 1.

  LOOP AT ifields.
    DATA field_type               TYPE feld-gtyp.


    CALL FUNCTION 'RS_SCRP_GET_FIELD_TYPE_TEXT'
      EXPORTING
        field      = ifields
        text_kind  = 'SHORT'
      IMPORTING
        field_type = field_type.

    CLEAR: ls_elements.
    ls_elements-name = ifields-fnam.
    ls_elements-type = field_type.
    ls_elements-col = ifields-coln.
    ls_elements-line = ifields-line.
    APPEND ls_elements TO ls_subobjects-elements.
  ENDLOOP.

  APPEND ls_subobjects TO s_object-sub_objects.

ENDFORM.
*&---------------------------------------------------------------------*
*&      Form  GET_FUGR
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_fugr .

  DATA: lt_func TYPE STANDARD TABLE OF tfunction WITH HEADER LINE.
  DATA: ls_subobject LIKE LINE OF s_object-sub_objects.
  DATA: ls_tfdir TYPE tfdir.
  DATA: lt_source      TYPE STANDARD TABLE OF abaptxt255.
  DATA: ls_incl LIKE LINE OF lt_func-iincludes.

* select by function name and/or function group.
  SELECT a~funcname AS functionname
         a~area AS functiongroup
         INTO CORRESPONDING FIELDS OF TABLE lt_func
         FROM v_fdir AS a
         INNER JOIN tlibv AS b
           ON a~area = b~area
         INNER JOIN tadir AS c
           ON a~area = c~obj_name
         WHERE a~area = s_tadir-obj_name
           AND a~generated = ''
           AND pgmid = 'R3TR'
           AND object = 'FUGR'
           ORDER BY a~area.

  CHECK sy-subrc = 0.

  s_object-object_type = 'FUGR'.
  s_object-name = s_tadir-obj_name.

  READ TABLE lt_func INDEX 1.
  CHECK sy-subrc = 0 .

  PERFORM retrievefunctiondetail USING lt_func-functionname
                                       lt_func-progname
                                       lt_func-includenumber
                                       lt_func-functiontitle.

  PERFORM findfunctiontopinclude USING lt_func-progname
                                       lt_func-functiongroup
                                       lt_func-topincludename.
  CLEAR: lt_source.
  READ REPORT lt_func-topincludename INTO lt_source.

  IF sy-subrc = 0.
    CLEAR: ls_subobject.
    ls_subobject-type = 'REPS'.
    ls_subobject-name = lt_func-topincludename.
    PERFORM t2s USING lt_source CHANGING ls_subobject-source.
    APPEND ls_subobject TO s_object-sub_objects.
  ENDIF.

  PERFORM scanforfunctionincludes USING lt_func-progname
                                        lt_func-iincludes[].

  LOOP AT lt_func-iincludes INTO ls_incl.
    CLEAR: lt_source.
    READ REPORT ls_incl-includename INTO lt_source.

    IF sy-subrc = 0.
      CLEAR: ls_subobject.
      ls_subobject-type = 'REPS'.
      ls_subobject-name =  ls_incl-includename.
      ls_subobject-description =  ls_incl-includetitle.
      PERFORM t2s USING lt_source CHANGING ls_subobject-source.
      APPEND ls_subobject TO s_object-sub_objects.
    ENDIF.
  ENDLOOP.

  DATA: iflow TYPE STANDARD TABLE OF tscreenflow WITH HEADER LINE.
  DATA: ls_reposrc TYPE reposrc.

  CLEAR: iflow.

  CALL FUNCTION 'DYNPRO_PROCESSINGLOGIC'
    EXPORTING
      rep_name  = lt_func-progname
    TABLES
      scr_logic = iflow.

  SORT iflow ASCENDING BY screen.
  DELETE ADJACENT DUPLICATES FROM iflow COMPARING screen.
  IF ls_reposrc-subc <> 'M'.
    DELETE iflow WHERE screen >= '1000' AND screen <= '1099'.
  ENDIF.

  LOOP AT iflow.
    PERFORM get_screen USING lt_func-progname iflow-screen.
  ENDLOOP.


  LOOP AT lt_func.
    PERFORM retrievefunctiondetail USING lt_func-functionname
                                          lt_func-progname
                                          lt_func-includenumber
                                          lt_func-functiontitle.
    CLEAR ls_subobject.
    ls_subobject-type = 'FUNC'.
    ls_subobject-name = lt_func-functionname.

    SELECT SINGLE * INTO ls_tfdir
      FROM tfdir
      WHERE funcname = lt_func-functionname.
    CHECK sy-subrc = 0.

    SELECT SINGLE stext FROM tftit
      INTO ls_subobject-description
      WHERE spras = sy-langu
        AND funcname = lt_func-functionname.

    PERFORM findmainfunctioninclude USING lt_func-progname
                                          lt_func-functiongroup
                                          lt_func-includenumber
                                          lt_func-functionmaininclude.

    READ REPORT lt_func-functionmaininclude INTO lt_source.

    IF sy-subrc = 0.
      PERFORM t2s USING lt_source CHANGING ls_subobject-source.
    ENDIF.

    DATA lt_import_parameter        TYPE STANDARD TABLE OF rsimp.
    DATA ls_import_parameter        TYPE rsimp.
    DATA lt_changing_parameter      TYPE STANDARD TABLE OF rscha.
    DATA ls_changing_parameter      TYPE rscha.
    DATA lt_export_parameter        TYPE STANDARD TABLE OF rsexp.
    DATA ls_export_parameter        TYPE   rsexp.
    DATA lt_tables_parameter        TYPE STANDARD TABLE OF rstbl.
    DATA ls_tables_parameter        TYPE   rstbl.
    DATA lt_exception_list          TYPE STANDARD TABLE OF rsexc.
    DATA ls_exception_list          TYPE   rsexc.
    DATA lt_documentation           TYPE STANDARD TABLE OF rsfdo.
    DATA ls_documentation           TYPE   rsfdo.
    DATA lt_fmsource                  TYPE STANDARD TABLE OF rssource.

    DATA: ls_parameters TYPE ty_method_parameters,
          ls_par        LIKE LINE OF ls_parameters-importing.

    CALL FUNCTION 'RPY_FUNCTIONMODULE_READ_NEW'
      EXPORTING
        functionname       = lt_func-functionname
      TABLES
        import_parameter   = lt_import_parameter
        changing_parameter = lt_changing_parameter
        export_parameter   = lt_export_parameter
        tables_parameter   = lt_tables_parameter
        exception_list     = lt_exception_list
        documentation      = lt_documentation
        source             = lt_fmsource
      EXCEPTIONS
        error_message      = 1
        function_not_found = 2
        invalid_name       = 3
        OTHERS             = 4.

    CLEAR: ls_parameters.
    LOOP AT lt_import_parameter INTO ls_import_parameter.
      CLEAR: ls_par.
      ls_par-name = ls_import_parameter-parameter.
      ls_par-type = ls_import_parameter-dbfield.
      ls_par-optional = ls_import_parameter-optional.
      READ TABLE lt_documentation INTO ls_documentation  WITH KEY parameter = ls_import_parameter-parameter
                                                                  kind = 'P'.
      IF sy-subrc = 0.
        ls_par-description = ls_documentation-stext.
      ENDIF.
      APPEND ls_par TO ls_parameters-importing.
    ENDLOOP.

    LOOP AT lt_changing_parameter INTO ls_changing_parameter.
      CLEAR: ls_par.
      ls_par-name = ls_changing_parameter-parameter.
      ls_par-type = ls_changing_parameter-dbfield.
      ls_par-optional = ls_changing_parameter-optional.
      READ TABLE lt_documentation INTO ls_documentation  WITH KEY parameter = ls_changing_parameter-parameter
                                                                  kind = 'P'.
      IF sy-subrc = 0.
        ls_par-description = ls_documentation-stext.
      ENDIF.
      APPEND ls_par TO ls_parameters-changing.
    ENDLOOP.

    LOOP AT lt_export_parameter INTO ls_export_parameter.
      CLEAR: ls_par.
      ls_par-name = ls_export_parameter-parameter.
      ls_par-type = ls_export_parameter-dbfield.
      READ TABLE lt_documentation INTO ls_documentation  WITH KEY parameter = ls_export_parameter-parameter
                                                                  kind = 'P'.
      IF sy-subrc = 0.
        ls_par-description = ls_documentation-stext.
      ENDIF.
      APPEND ls_par TO ls_parameters-exporting.
    ENDLOOP.

    LOOP AT lt_tables_parameter INTO ls_tables_parameter.
      CLEAR: ls_par.
      ls_par-name = ls_tables_parameter-parameter.
      ls_par-type = ls_tables_parameter-dbstruct.
      ls_par-optional = ls_tables_parameter-optional.
      READ TABLE lt_documentation INTO ls_documentation  WITH KEY parameter = ls_tables_parameter-parameter
                                                                  kind = 'P'.
      IF sy-subrc = 0.
        ls_par-description = ls_documentation-stext.
      ENDIF.
      APPEND ls_par TO ls_parameters-tables.
    ENDLOOP.

    LOOP AT lt_exception_list INTO ls_exception_list.
      CLEAR: ls_par.
      ls_par-name = ls_exception_list-exception.

      READ TABLE lt_documentation INTO ls_documentation  WITH KEY parameter = ls_exception_list-exception
                                                                  kind = 'X'.
      IF sy-subrc = 0.
        ls_par-description = ls_documentation-stext.
      ENDIF.
      APPEND ls_par TO ls_parameters-exceptions.
    ENDLOOP.


    ls_subobject-parameters = ls_parameters.
    APPEND ls_subobject TO s_object-sub_objects.
  ENDLOOP.

ENDFORM.

*----------------------------------------------------------------------------------------------------------------------
*  findMainFunctionInclude...  Find the main include that contains the source code
*----------------------------------------------------------------------------------------------------------------------
FORM findmainfunctioninclude USING VALUE(programname)
                                   VALUE(functiongroup)
                                   VALUE(functionincludeno)
                                         functionincludename.

  DATA: namespace        TYPE string,
        iresults         TYPE match_result_tab,
        waresult         TYPE match_result,
        startingposition TYPE i.

  FIND ALL OCCURRENCES OF '/' IN functiongroup RESULTS iresults.
  IF sy-subrc = 0.
    READ TABLE iresults INDEX sy-tfill INTO waresult.
    startingposition = waresult-offset + 1.
    namespace = functiongroup+0(startingposition).
    functiongroup = functiongroup+startingposition.
  ENDIF.

  CONCATENATE namespace 'L' functiongroup 'U' functionincludeno INTO functionincludename.
ENDFORM.

*----------------------------------------------------------------------------------------------------------------------
*  findFunctionTopInclude...  Find the top include for the function group
*----------------------------------------------------------------------------------------------------------------------
FORM findfunctiontopinclude USING VALUE(programname)
                                  VALUE(functiongroup)
                                        topincludename.

  DATA: namespace        TYPE string,
        iresults         TYPE match_result_tab,
        waresult         TYPE match_result,
        startingposition TYPE i.

  FIND ALL OCCURRENCES OF '/' IN functiongroup RESULTS iresults.
  IF sy-subrc = 0.
    READ TABLE iresults INDEX sy-tfill INTO waresult.
    startingposition = waresult-offset + 1.
    namespace = functiongroup+0(startingposition).
    functiongroup = functiongroup+startingposition.
  ENDIF.

  CONCATENATE namespace 'L' functiongroup 'TOP' INTO topincludename.
ENDFORM.                                                                                        "findMainFunctionInclude

*----------------------------------------------------------------------------------------------------------------------
*  scanForFunctionIncludes... Find all user defined includes within the function group
*----------------------------------------------------------------------------------------------------------------------
FORM scanforfunctionincludes USING poolname
                                   ilocincludes LIKE dumiincludes[].

  DATA: iincludelines TYPE STANDARD TABLE OF string WITH HEADER LINE.
  DATA: itokens TYPE STANDARD TABLE OF stokes WITH HEADER LINE.
  DATA: ikeywords TYPE STANDARD TABLE OF text20 WITH HEADER LINE.
  DATA: istatements TYPE STANDARD TABLE OF sstmnt WITH HEADER LINE.
  DATA: watokens TYPE stokes.
  DATA: wainclude TYPE tinclude.
  DATA: waincludeexists TYPE tinclude.
  DATA: maxlines TYPE i.
  DATA: nextline TYPE i.
  DATA: castprogramname TYPE program.

* Read the program code from the textpool.
  castprogramname = poolname.
  READ REPORT castprogramname INTO iincludelines.

  APPEND 'INCLUDE' TO ikeywords.
  SCAN ABAP-SOURCE iincludelines TOKENS INTO itokens WITH INCLUDES STATEMENTS INTO istatements KEYWORDS FROM ikeywords.

  CLEAR iincludelines[].

  maxlines = lines( itokens ).
  LOOP AT itokens WHERE str = 'INCLUDE' AND type = 'I'.
    nextline = sy-tabix + 1.
    IF nextline <= maxlines.
      READ TABLE itokens INDEX nextline INTO watokens.

      IF watokens-str CP '*F++'.
        TRY.
            IF watokens-str+0(2) = 'LY' OR watokens-str+0(2) = 'LZ'.
            ELSE.
              CONTINUE.
            ENDIF.
          CATCH cx_sy_range_out_of_bounds.
        ENDTRY.


        wainclude-includename = watokens-str.

*        Best find the program title text as well.
        PERFORM findprogramorincludetitle USING wainclude-includename
                                                wainclude-includetitle.

*        Don't append the include if we already have it listed
*        READ TABLE ilocincludes INTO waincludeexists WITH KEY includename = wainclude-includename.

        APPEND wainclude TO ilocincludes.

      ENDIF.
    ENDIF.
  ENDLOOP.
ENDFORM.

*----------------------------------------------------------------------------------------------------------------------
*  findProgramOrIncludeTitle...   Finds the title text of a program.
*----------------------------------------------------------------------------------------------------------------------
FORM findprogramorincludetitle USING VALUE(programname)
                                           titletext.

  SELECT SINGLE text
                FROM trdirt
                INTO titletext
                WHERE name = programname
                  AND sprsl = sy-langu.
ENDFORM.

*----------------------------------------------------------------------------------------------------------------------
*  retrieveFunctionDetail...   Retrieve function module details from SAP DB.
*----------------------------------------------------------------------------------------------------------------------
FORM retrievefunctiondetail USING VALUE(functionname)
                                        progname
                                        includename
                                        titletext.

  SELECT SINGLE pname
                include
                FROM tfdir
                INTO (progname, includename)
                WHERE funcname = functionname.

  IF sy-subrc = 0.
    SELECT SINGLE stext
                  FROM tftit
                  INTO titletext
                  WHERE spras = sy-langu
                    AND funcname = functionname.
  ENDIF.
ENDFORM.                                                                                        "retrieveFunctionDetail
*&---------------------------------------------------------------------*
*&      Form  GET_CLASS
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_class .

  DATA: ls_class   TYPE tclass,
        ls_imethod LIKE LINE OF ls_class-imethods.
  DATA: lt_source TYPE STANDARD TABLE OF abaptxt255,
        lt_def    TYPE STANDARD TABLE OF abaptxt255,
        ls_source TYPE abaptxt255.
  DATA: castclassname TYPE program.
  DATA: ls_method     LIKE LINE OF s_object-components-methods,
        ls_attr       LIKE LINE OF s_object-components-attributes,
        ls_parameters TYPE ty_method_parameters,
        ls_par        LIKE LINE OF ls_parameters-importing.



  ls_class-clsname =   s_tadir-obj_name.

  PERFORM buildclasskeys USING ls_class.

  IF ls_class-descript IS INITIAL.
    PERFORM findclassdescription USING ls_class-clsname
                                       ls_class-descript.
  ENDIF.

  s_object-object_type = 'CLAS'.
  s_object-name = ls_class-clsname.
  s_object-description = ls_class-descript.

  castclassname = ls_class-publicclasskey.
  READ REPORT castclassname INTO  lt_source.
  APPEND LINES OF lt_source TO lt_def.

  castclassname = ls_class-privateclasskey.
  READ REPORT castclassname INTO lt_source.
  APPEND LINES OF lt_source TO lt_def.

  castclassname = ls_class-protectedclasskey.
  READ REPORT castclassname INTO lt_source.
  APPEND LINES OF lt_source TO lt_def.

  castclassname = ls_class-typesclasskey.
  READ REPORT castclassname INTO lt_source.
  APPEND LINES OF lt_source TO lt_def.

  PERFORM t2s USING lt_def CHANGING s_object-definition.

  PERFORM findclassmethods USING ls_class-clsname
                                 ls_class-imethods[].



  DATA: lo_descr      TYPE REF TO cl_abap_typedescr,
        lo_obj_descr  TYPE REF TO cl_abap_objectdescr,
        lt_attributes TYPE abap_attrdescr_tab,
        ls_attrdesc   TYPE abap_attrdescr,
        lo_type_attr  TYPE REF TO cl_abap_typedescr.


  CALL METHOD cl_abap_typedescr=>describe_by_name
    EXPORTING
      p_name         = s_tadir-obj_name
    RECEIVING
      p_descr_ref    = lo_descr
    EXCEPTIONS
      type_not_found = 1
      OTHERS         = 2.

  TRY.
      lo_obj_descr ?= lo_descr.
    CATCH cx_sy_move_cast_error.

  ENDTRY.

  lt_attributes = lo_obj_descr->attributes.


  LOOP AT lt_attributes INTO ls_attrdesc.


    lo_type_attr = lo_obj_descr->get_attribute_type( p_name = ls_attrdesc-name ).
    CLEAR ls_attr.
    ls_attr-name = ls_attrdesc-name(30).
    ls_attr-type = lo_type_attr->absolute_name.
    ls_attr-visibility = ls_attrdesc-visibility.
    APPEND ls_attr TO s_object-components-attributes.
  ENDLOOP.

  DATA: lt_dmethods TYPE abap_methdescr_tab,
        ls_dmethod  TYPE abap_methdescr.
  DATA: ls_param      TYPE abap_parmdescr,
        lo_param_type TYPE REF TO cl_abap_typedescr.

  lt_dmethods = lo_obj_descr->methods.

  LOOP AT ls_class-imethods[] INTO ls_imethod.
    CLEAR: ls_dmethod.
    READ TABLE lt_dmethods INTO ls_dmethod WITH KEY name = ls_imethod-cmpname.

    castclassname = ls_imethod-methodkey.
    READ REPORT castclassname INTO lt_source.

    CLEAR: ls_method.
    ls_method-name = ls_imethod-cmpname.
    ls_method-description = ls_imethod-descript.
    PERFORM t2s USING lt_source CHANGING ls_method-source.
    CLEAR: ls_parameters.
    LOOP AT ls_dmethod-parameters INTO ls_param.
      CALL METHOD lo_obj_descr->get_method_parameter_type
        EXPORTING
          p_method_name    = ls_imethod-cmpname
          p_parameter_name = ls_param-name
        RECEIVING
          p_descr_ref      = lo_param_type
        EXCEPTIONS
          OTHERS           = 1.

      ls_par-name = ls_param-name.
      ls_par-type = lo_param_type->absolute_name.

      CASE ls_param-parm_kind.
        WHEN 'I'. APPEND ls_par TO ls_parameters-importing.
        WHEN 'E'. APPEND ls_par TO ls_parameters-exporting.
        WHEN 'C'. APPEND ls_par TO ls_parameters-changing.
        WHEN 'R'. APPEND ls_par TO ls_parameters-returning.
      ENDCASE.
    ENDLOOP.
    ls_method-parameters = ls_parameters.
    APPEND ls_method TO s_object-components-methods.
  ENDLOOP.
ENDFORM.

*-------------------------------------------------------------------------------------------------------
*  buildClassKeys...   Finds the title text of a class.
*-------------------------------------------------------------------------------------------------------
FORM buildclasskeys USING waclass TYPE tclass.

  DATA: classnamelength TYPE i.
  DATA: loops TYPE i.

  classnamelength = strlen( waclass-clsname ).

  cl_oo_classname_service=>get_pubsec_name( EXPORTING clsname = waclass-clsname
                                            RECEIVING result = waclass-publicclasskey ).

  cl_oo_classname_service=>get_prisec_name( EXPORTING clsname = waclass-clsname
                                            RECEIVING result = waclass-privateclasskey ).

  cl_oo_classname_service=>get_prosec_name( EXPORTING clsname = waclass-clsname
                                            RECEIVING result = waclass-protectedclasskey ).


* Text element key - length of text element key has to be 32 characters.
  loops = 30 - classnamelength.
  waclass-textelementkey = waclass-clsname.
  DO loops TIMES.
    CONCATENATE waclass-textelementkey '=' INTO waclass-textelementkey.
  ENDDO.
* Save this for later.
  CONCATENATE waclass-textelementkey 'CP' INTO waclass-textelementkey.

* Types Class key - length of class name has to be 32 characters.
  loops = 30 - classnamelength.
  waclass-typesclasskey = waclass-clsname.
  DO loops TIMES.
    CONCATENATE waclass-typesclasskey '=' INTO waclass-typesclasskey.
  ENDDO.
* Save this for later
  CONCATENATE waclass-typesclasskey 'CT' INTO waclass-typesclasskey.
ENDFORM.

*-------------------------------------------------------------------------------------------------------
*  findClassDescription...   Finds the title text of a class.
*-------------------------------------------------------------------------------------------------------
FORM findclassdescription USING VALUE(classname)
                                      titletext.

  SELECT SINGLE descript
                FROM vseoclass
                INTO titletext
                WHERE clsname = classname
                  AND langu = sy-langu.
  IF sy-subrc <> 0.
    SELECT SINGLE descript
                  FROM vseoclass
                  INTO titletext
                  WHERE clsname = classname.
  ENDIF.
ENDFORM.                                                                           "findClassDescription

*-------------------------------------------------------------------------------------------------------
*  findClassMethods...   Finds the methods of a class.
*-------------------------------------------------------------------------------------------------------
FORM findclassmethods USING VALUE(classname)
                            ilocmethods LIKE dumimethods[].

  DATA: imethods TYPE STANDARD TABLE OF tmethod WITH HEADER LINE.
  DATA: iredefinedmethods TYPE STANDARD TABLE OF seoredef WITH HEADER LINE.
  DATA: originalclassname TYPE seoclsname.
  DATA: wamethod LIKE LINE OF imethods.

  SELECT cmpname descript exposure
         FROM vseomethod
         INTO CORRESPONDING FIELDS OF TABLE imethods
           WHERE clsname = classname
             AND version = '1'
             AND langu = sy-langu
             AND ( state = '0' OR state = '1' ).

  IF sy-subrc <> 0.
    SELECT cmpname descript exposure
           FROM vseomethod
           INTO CORRESPONDING FIELDS OF TABLE imethods
           WHERE clsname = classname
             AND version = '0'
             AND langu = sy-langu
             AND ( state = '0' OR state = '1' ).
  ENDIF.

  SELECT *
         FROM seoredef
         INTO TABLE iredefinedmethods
         WHERE clsname = classname
           AND version = '1'.

*  For Each method we must find the original class the method was created in
  LOOP AT iredefinedmethods.
    PERFORM findredefinitionclass USING iredefinedmethods-refclsname
                                        iredefinedmethods-mtdname
                                        originalclassname.

    wamethod-cmpname = iredefinedmethods-mtdname.

    SELECT SINGLE descript exposure
        FROM vseomethod
        INTO CORRESPONDING FIELDS OF  wamethod
          WHERE clsname = originalclassname
            AND cmpname = iredefinedmethods-mtdname
            AND version = '1'
            AND langu = sy-langu
            AND ( state = '0' OR state = '1' ).

    CONCATENATE `Redefined: ` wamethod-descript INTO wamethod-descript.
    APPEND wamethod TO imethods.
  ENDLOOP.

* Find the method key so that we can acces the source code later
  LOOP AT imethods.
    PERFORM findmethodkey USING classname
                                imethods-cmpname
                                imethods-methodkey.
    APPEND imethods TO ilocmethods.
  ENDLOOP.
ENDFORM.                                                                               "findClassMethods

*-------------------------------------------------------------------------------------------------------
* findMethodKey... find the unique key which identifes this method
*-------------------------------------------------------------------------------------------------------
FORM findmethodkey USING VALUE(classname)
                         VALUE(methodname)
                               methodkey.

  DATA: methodid TYPE seocpdkey.
  DATA: locmethodkey TYPE program.

  methodid-clsname = classname.
  methodid-cpdname = methodname.

  cl_oo_classname_service=>get_method_include( EXPORTING mtdkey = methodid
                                               RECEIVING result = locmethodkey
                                               EXCEPTIONS class_not_existing = 1
                                                          method_not_existing = 2 ).

  methodkey = locmethodkey.
ENDFORM.                                                                                  "findMethodKey

*-------------------------------------------------------------------------------------------------------
* findRedefinitionClass... find the original class the method was redefined from
*-------------------------------------------------------------------------------------------------------
FORM findredefinitionclass USING VALUE(redefinedclassname) TYPE seoclsname
                                 VALUE(methodname) TYPE seocpdname
                                       originalclassname TYPE seoclsname.

  DATA: waredef TYPE seoredef.

  SELECT SINGLE *
         FROM seoredef
         INTO waredef
         WHERE refclsname = redefinedclassname
           AND mtdname = methodname.

  IF sy-subrc = 0.
*   There is a higher class still.
    originalclassname = waredef-refclsname.
    PERFORM findredefinitionclassrecur USING waredef-refclsname
                                             waredef-mtdname
                                             originalclassname.
  ELSE.
*   We are at the higher class.
    originalclassname = waredef-refclsname.
  ENDIF.
ENDFORM.

*-------------------------------------------------------------------------------------------------------
* findRedefinitionClassRecur... Recursively find the original class the method was redefined from
*-------------------------------------------------------------------------------------------------------
FORM findredefinitionclassrecur USING VALUE(redefinedclassname) TYPE seoclsname
                                 VALUE(methodname) TYPE seocpdname
                                       originalclassname TYPE seoclsname.

  DATA: waredef TYPE seoredef.

  SELECT SINGLE *
         FROM seoredef
         INTO waredef
         WHERE clsname = redefinedclassname
           AND mtdname = methodname.

  IF sy-subrc = 0.
*   There is a higher class still.
    originalclassname = waredef-refclsname.
    PERFORM findredefinitionclassrecur USING waredef-refclsname
                                             waredef-mtdname
                                             originalclassname.
  ENDIF.
ENDFORM.
*&---------------------------------------------------------------------*
*&      Form  GET_XSLT
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_xslt .

  DATA: ilocxsltsource TYPE o2pageline_table.
  DATA: waxsltattributes TYPE o2xsltattr.

  cl_o2_api_xsltdesc=>load( EXPORTING p_xslt_desc = s_tadir-obj_name
                          IMPORTING p_source = ilocxsltsource
                                    p_attributes = waxsltattributes
                          EXCEPTIONS not_existing = 1
                                     permission_failure = 2
                                     error_occured = 3
                                     version_not_found = 4 ).


  s_object-object_type = 'XSLT'.
  s_object-name = s_tadir-obj_name.
  s_object-description = waxsltattributes-descript.

  PERFORM t2s USING ilocxsltsource CHANGING s_object-source.

ENDFORM.
*&---------------------------------------------------------------------*
*&      Form  GET_TAB
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_tab .

  DATA: lt_dfies    TYPE TABLE OF dfies,
        ls_dfies    TYPE dfies,
        lv_sysid    TYPE string,
        lv_devclass TYPE devclass,
        ls_dd02v    TYPE x030l.
  DATA: ls_fields LIKE LINE OF s_object-fields.

  DATA: lv_field_json TYPE string,
        lv_key        TYPE string.

  DATA: l_name TYPE ddobjname.

  l_name = s_tadir-obj_name.

  CALL FUNCTION 'DDIF_FIELDINFO_GET'
    EXPORTING
      tabname        = l_name
      langu          = sy-langu
    IMPORTING
      x030l_wa       = ls_dd02v
    TABLES
      dfies_tab      = lt_dfies
    EXCEPTIONS
      not_found      = 1
      internal_error = 2
      OTHERS         = 3.

  LOOP AT lt_dfies INTO ls_dfies.
    CLEAR: ls_fields.

    ls_fields-key = ls_dfies-keyflag.
    ls_fields-name = ls_dfies-fieldname.
    ls_fields-type = ls_dfies-datatype.
    ls_fields-length  = ls_dfies-leng.
    ls_fields-data_element = ls_dfies-rollname.
    ls_fields-domain = ls_dfies-domname.
    ls_fields-description = ls_dfies-fieldtext.
    APPEND ls_fields TO s_object-fields.
  ENDLOOP.

  IF sy-subrc = 0.

    s_object-object_type = 'TABL'.
    s_object-name = s_tadir-obj_name.
    SELECT SINGLE ddtext
                  FROM dd02t
                  INTO s_object-description
                  WHERE tabname = l_name
                   AND ddlanguage = sy-langu.

  ENDIF.



ENDFORM.
*&---------------------------------------------------------------------*
*&      Form  GET_DOMA
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_doma .

  DATA: ls_dd01v TYPE dd01v,    " Doména header
        lt_dd07v TYPE TABLE OF dd07v, " Doména hodnoty
        ls_dd07v TYPE dd07v,
        ls_dd04v TYPE dd04v,    " Dátový prvok
        ls_dd40v TYPE dd40v.    " Tabuľkový typ
  DATA: ls_val LIKE LINE OF s_object-values.

  DATA: l_name TYPE ddobjname.

  l_name = s_tadir-obj_name.

  CALL FUNCTION 'DDIF_DOMA_GET'
    EXPORTING
      name      = l_name
      langu     = sy-langu
    IMPORTING
      dd01v_wa  = ls_dd01v
    TABLES
      dd07v_tab = lt_dd07v
    EXCEPTIONS
      OTHERS    = 1.

  CHECK NOT ls_dd01v-domname IS INITIAL.

  s_object-object_type = 'DOMA'.
  s_object-name = ls_dd01v-domname.
  s_object-description = ls_dd01v-ddtext.
  s_object-type = ls_dd01v-datatype.
  s_object-length = ls_dd01v-leng.

  LOOP AT lt_dd07v INTO ls_dd07v.
    CLEAR: ls_val.
    ls_val-value = ls_dd07v-domvalue_l.
    ls_val-description  = ls_dd07v-ddtext  .
    APPEND ls_val TO s_object-values.
  ENDLOOP.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_DOMA
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_dtel .

  DATA: ls_dd01v TYPE dd01v,    " Doména header
        lt_dd07v TYPE TABLE OF dd07v, " Doména hodnoty
        ls_dd07v TYPE dd07v,
        ls_dd04v TYPE dd04v,    " Dátový prvok
        ls_dd40v TYPE dd40v.    " Tabuľkový typ

  DATA: l_name TYPE ddobjname.

  l_name = s_tadir-obj_name.

  CALL FUNCTION 'DDIF_DTEL_GET'
    EXPORTING
      name     = l_name
      langu    = sy-langu
    IMPORTING
      dd04v_wa = ls_dd04v
    EXCEPTIONS
      OTHERS   = 1.

  CHECK NOT ls_dd04v-rollname IS INITIAL.

  s_object-object_type = 'DTEL'.
  s_object-name = ls_dd04v-rollname.
  s_object-description = ls_dd04v-ddtext.
  s_object-type =  ls_dd04v-datatype.
  s_object-domain =  ls_dd04v-domname.
  s_object-length = ls_dd04v-leng.
  s_object-labels-long = ls_dd04v-scrtext_l.
  s_object-labels-medium = ls_dd04v-scrtext_m.
  s_object-labels-short = ls_dd04v-scrtext_s.
  s_object-labels-heading = ls_dd04v-reptext.


ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_DOMA
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_ttyp .

  DATA: ls_dd40v TYPE dd40v.    " Tabuľkový typ

  DATA: l_name TYPE ddobjname.

  l_name = s_tadir-obj_name.

  CALL FUNCTION 'DDIF_TTYP_GET'
    EXPORTING
      name     = l_name
    IMPORTING
      dd40v_wa = ls_dd40v
    EXCEPTIONS
      OTHERS   = 1.

  IF sy-subrc = 0 AND ls_dd40v-typename IS NOT INITIAL.


    s_object-object_type = 'TTYP'.
    s_object-name = ls_dd40v-typename.
    s_object-description = ls_dd40v-ddtext.
    s_object-type =  ls_dd40v-datatype.
    s_object-line_type =  ls_dd40v-rowtype.
    s_object-access_mode =  ls_dd40v-accessmode.
    s_object-key_type =  ls_dd40v-keykind.

  ENDIF.




ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_DOMA
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_msag .

  DATA: ls_t100a TYPE t100a,
        lt_t100  TYPE TABLE OF t100,
        ls_t100  TYPE t100.
  DATA: ls_msg LIKE LINE OF s_object-messages.


  SELECT SINGLE * FROM t100a INTO ls_t100a WHERE arbgb = s_tadir-obj_name.
  IF sy-subrc = 0.
    s_object-name = ls_t100a-arbgb.
    s_object-object_type = 'MSAG'.
    SELECT * FROM t100 INTO  ls_t100
      WHERE arbgb = ls_t100a-arbgb AND sprsl = sy-langu.
      CLEAR: ls_msg.
      ls_msg-number = ls_t100-msgnr.
      ls_msg-text = ls_t100-text.
      APPEND ls_msg TO s_object-messages.
    ENDSELECT.
  ENDIF.




ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_DOMA
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_tran .

  DATA: ls_tstc  TYPE tstc,
        ls_tstct TYPE tstct.

  SELECT SINGLE * FROM tstc INTO ls_tstc WHERE tcode = s_tadir-obj_name.
  IF sy-subrc = 0.
    SELECT SINGLE * FROM tstct INTO ls_tstct
        WHERE tcode = ls_tstc-tcode AND sprsl = sy-langu.
    s_object-name = s_tadir-obj_name.
    s_object-object_type = 'TRAN'.
    s_object-description = ls_tstct-ttext.
    s_object-program = ls_tstc-pgmna.
    s_object-screen = ls_tstc-dypno.


  ENDIF.


ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_DOMA
*&---------------------------------------------------------------------*
*       text
*----------------------------------------------------------------------*
*  -->  p1        text
*  <--  p2        text
*----------------------------------------------------------------------*
FORM get_iatu.

  DATA: l_name     TYPE iacikeyt,
        l_template TYPE REF TO if_w3_api_template.
  DATA: l_source TYPE w3htmltabtype.

  l_name = s_tadir-obj_name.

  CALL METHOD cl_w3_api_template=>if_w3_api_template~load
    EXPORTING
      p_template_name     = l_name
    IMPORTING
      p_template          = l_template
    EXCEPTIONS
      object_not_existing = 1
      permission_failure  = 2
      data_corrupt        = 3
      error_occured       = 4.

  l_template->get_source(
   IMPORTING
     p_source = l_source  ).

  s_object-object_type = 'SIAC'.
  s_object-name = l_name.
  s_object-encoding = 'base64'.

  DATA: lv_xstring TYPE xstring.


  PERFORM t2s USING l_source CHANGING s_object-source.

  CALL FUNCTION 'SCMS_STRING_TO_XSTRING'
    EXPORTING
      text   = s_object-source
    IMPORTING
      buffer = lv_xstring.

  CALL FUNCTION 'SCMS_BASE64_ENCODE_STR'
    EXPORTING
      input  = lv_xstring
    IMPORTING
      output = s_object-source.






ENDFORM.