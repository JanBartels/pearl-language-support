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

#endif

SPC GlobProcHuhu PROC GLOBAL;
