#ifndef _testinc_h_
#define _testinc_h_

!#undef eineMeldungAusTestincH

SPC GlobProc PROC GLOBAL;

TYPE TestStruct STRUCT [
    Element1 FIXED,
    Element2 FLOAT
];

/* hier kommt ein Blockkommentar,
der ganz lang ist,
um den Collector der Hauptdatei
zu verwirren */

SPC ASSIGN ENTRY( DATION INOUTP90_ ALPHIC IDENT, CHAR(24)) GLOBAL;

#define AusEinerAnderenWelt "'Ich bin ein Alien"

#endif

SPC GlobProcHuhu PROC GLOBAL;
