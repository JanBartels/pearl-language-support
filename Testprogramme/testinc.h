#ifndef _testinc_h_
#define _testinc_h_

!#undef eineMeldungAusTestincH

SPC GlobProc PROC GLOBAL;

TYPE TestStruct STRUCT [
    Element1 FIXED,
    Element2 FLOAT
];

DCL ExtVar FIXED;

/* hier kommt ein Blockkommentar,
der ganz lang ist,
um den Collector der Hauptdatei
zu verwirren */

SPC ASSIGN ENTRY( /* Dation */ DATION INOUTP90_ ALPHIC IDENT, /* Devicename */ CHAR(24)) GLOBAL;

#define AusEinerAnderenWelt "'Ich bin ein Alien"

#endif

SPC GlobProcHuhu PROC GLOBAL;
