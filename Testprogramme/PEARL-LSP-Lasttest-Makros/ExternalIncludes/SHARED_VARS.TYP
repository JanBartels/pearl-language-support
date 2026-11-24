! Lasttest mit verschachtelter rekursiver Makroexpansion.
! Bewusst derselbe Aufbau wie ein reales UH-PEARL-Programm.
! DEKLARATIONEN wird durch die einbindende .P-Datei definiert.
#ifdef DEKLARATIONEN
#define VAR "DCL"
#define WertIst " "
#define WertEnde " "
#else
#define VAR "SPC"
#define WertIst "/*"
#define WertEnde "*/"
#endif
#define Count "40"
#define Boundary "WertIst 0:Count WertEnde"
! Bei DCL entstehen gebundene Felder; bei SPC wird die Grenze auskommentiert.
VAR StressShared0001( Boundary ) FIXED GLOBAL;
! Makrofall 0001: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0002( Boundary ) FIXED GLOBAL;
! Makrofall 0002: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0003( Boundary ) FIXED GLOBAL;
! Makrofall 0003: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0004( Boundary ) FIXED GLOBAL;
! Makrofall 0004: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0005( Boundary ) FIXED GLOBAL;
! Makrofall 0005: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0006( Boundary ) FIXED GLOBAL;
! Makrofall 0006: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0007( Boundary ) FIXED GLOBAL;
! Makrofall 0007: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0008( Boundary ) FIXED GLOBAL;
! Makrofall 0008: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0009( Boundary ) FIXED GLOBAL;
! Makrofall 0009: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0010( Boundary ) FIXED GLOBAL;
! Makrofall 0010: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0011( Boundary ) FIXED GLOBAL;
! Makrofall 0011: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0012( Boundary ) FIXED GLOBAL;
! Makrofall 0012: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0013( Boundary ) FIXED GLOBAL;
! Makrofall 0013: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0014( Boundary ) FIXED GLOBAL;
! Makrofall 0014: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0015( Boundary ) FIXED GLOBAL;
! Makrofall 0015: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0016( Boundary ) FIXED GLOBAL;
! Makrofall 0016: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0017( Boundary ) FIXED GLOBAL;
! Makrofall 0017: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0018( Boundary ) FIXED GLOBAL;
! Makrofall 0018: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0019( Boundary ) FIXED GLOBAL;
! Makrofall 0019: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0020( Boundary ) FIXED GLOBAL;
! Makrofall 0020: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0021( Boundary ) FIXED GLOBAL;
! Makrofall 0021: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0022( Boundary ) FIXED GLOBAL;
! Makrofall 0022: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0023( Boundary ) FIXED GLOBAL;
! Makrofall 0023: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0024( Boundary ) FIXED GLOBAL;
! Makrofall 0024: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0025( Boundary ) FIXED GLOBAL;
! Makrofall 0025: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0026( Boundary ) FIXED GLOBAL;
! Makrofall 0026: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0027( Boundary ) FIXED GLOBAL;
! Makrofall 0027: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0028( Boundary ) FIXED GLOBAL;
! Makrofall 0028: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0029( Boundary ) FIXED GLOBAL;
! Makrofall 0029: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0030( Boundary ) FIXED GLOBAL;
! Makrofall 0030: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0031( Boundary ) FIXED GLOBAL;
! Makrofall 0031: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0032( Boundary ) FIXED GLOBAL;
! Makrofall 0032: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0033( Boundary ) FIXED GLOBAL;
! Makrofall 0033: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0034( Boundary ) FIXED GLOBAL;
! Makrofall 0034: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0035( Boundary ) FIXED GLOBAL;
! Makrofall 0035: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0036( Boundary ) FIXED GLOBAL;
! Makrofall 0036: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0037( Boundary ) FIXED GLOBAL;
! Makrofall 0037: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0038( Boundary ) FIXED GLOBAL;
! Makrofall 0038: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0039( Boundary ) FIXED GLOBAL;
! Makrofall 0039: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0040( Boundary ) FIXED GLOBAL;
! Makrofall 0040: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0041( Boundary ) FIXED GLOBAL;
! Makrofall 0041: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0042( Boundary ) FIXED GLOBAL;
! Makrofall 0042: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0043( Boundary ) FIXED GLOBAL;
! Makrofall 0043: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0044( Boundary ) FIXED GLOBAL;
! Makrofall 0044: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0045( Boundary ) FIXED GLOBAL;
! Makrofall 0045: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0046( Boundary ) FIXED GLOBAL;
! Makrofall 0046: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0047( Boundary ) FIXED GLOBAL;
! Makrofall 0047: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0048( Boundary ) FIXED GLOBAL;
! Makrofall 0048: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0049( Boundary ) FIXED GLOBAL;
! Makrofall 0049: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0050( Boundary ) FIXED GLOBAL;
! Makrofall 0050: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0051( Boundary ) FIXED GLOBAL;
! Makrofall 0051: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0052( Boundary ) FIXED GLOBAL;
! Makrofall 0052: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0053( Boundary ) FIXED GLOBAL;
! Makrofall 0053: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0054( Boundary ) FIXED GLOBAL;
! Makrofall 0054: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0055( Boundary ) FIXED GLOBAL;
! Makrofall 0055: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0056( Boundary ) FIXED GLOBAL;
! Makrofall 0056: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0057( Boundary ) FIXED GLOBAL;
! Makrofall 0057: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0058( Boundary ) FIXED GLOBAL;
! Makrofall 0058: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0059( Boundary ) FIXED GLOBAL;
! Makrofall 0059: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0060( Boundary ) FIXED GLOBAL;
! Makrofall 0060: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0061( Boundary ) FIXED GLOBAL;
! Makrofall 0061: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0062( Boundary ) FIXED GLOBAL;
! Makrofall 0062: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0063( Boundary ) FIXED GLOBAL;
! Makrofall 0063: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0064( Boundary ) FIXED GLOBAL;
! Makrofall 0064: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0065( Boundary ) FIXED GLOBAL;
! Makrofall 0065: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0066( Boundary ) FIXED GLOBAL;
! Makrofall 0066: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0067( Boundary ) FIXED GLOBAL;
! Makrofall 0067: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0068( Boundary ) FIXED GLOBAL;
! Makrofall 0068: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0069( Boundary ) FIXED GLOBAL;
! Makrofall 0069: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0070( Boundary ) FIXED GLOBAL;
! Makrofall 0070: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0071( Boundary ) FIXED GLOBAL;
! Makrofall 0071: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0072( Boundary ) FIXED GLOBAL;
! Makrofall 0072: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0073( Boundary ) FIXED GLOBAL;
! Makrofall 0073: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0074( Boundary ) FIXED GLOBAL;
! Makrofall 0074: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0075( Boundary ) FIXED GLOBAL;
! Makrofall 0075: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0076( Boundary ) FIXED GLOBAL;
! Makrofall 0076: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0077( Boundary ) FIXED GLOBAL;
! Makrofall 0077: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0078( Boundary ) FIXED GLOBAL;
! Makrofall 0078: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0079( Boundary ) FIXED GLOBAL;
! Makrofall 0079: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0080( Boundary ) FIXED GLOBAL;
! Makrofall 0080: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0081( Boundary ) FIXED GLOBAL;
! Makrofall 0081: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0082( Boundary ) FIXED GLOBAL;
! Makrofall 0082: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0083( Boundary ) FIXED GLOBAL;
! Makrofall 0083: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0084( Boundary ) FIXED GLOBAL;
! Makrofall 0084: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0085( Boundary ) FIXED GLOBAL;
! Makrofall 0085: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0086( Boundary ) FIXED GLOBAL;
! Makrofall 0086: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0087( Boundary ) FIXED GLOBAL;
! Makrofall 0087: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0088( Boundary ) FIXED GLOBAL;
! Makrofall 0088: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0089( Boundary ) FIXED GLOBAL;
! Makrofall 0089: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0090( Boundary ) FIXED GLOBAL;
! Makrofall 0090: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0091( Boundary ) FIXED GLOBAL;
! Makrofall 0091: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0092( Boundary ) FIXED GLOBAL;
! Makrofall 0092: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0093( Boundary ) FIXED GLOBAL;
! Makrofall 0093: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0094( Boundary ) FIXED GLOBAL;
! Makrofall 0094: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0095( Boundary ) FIXED GLOBAL;
! Makrofall 0095: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0096( Boundary ) FIXED GLOBAL;
! Makrofall 0096: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0097( Boundary ) FIXED GLOBAL;
! Makrofall 0097: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0098( Boundary ) FIXED GLOBAL;
! Makrofall 0098: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0099( Boundary ) FIXED GLOBAL;
! Makrofall 0099: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0100( Boundary ) FIXED GLOBAL;
! Makrofall 0100: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0101( Boundary ) FIXED GLOBAL;
! Makrofall 0101: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0102( Boundary ) FIXED GLOBAL;
! Makrofall 0102: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0103( Boundary ) FIXED GLOBAL;
! Makrofall 0103: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0104( Boundary ) FIXED GLOBAL;
! Makrofall 0104: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0105( Boundary ) FIXED GLOBAL;
! Makrofall 0105: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0106( Boundary ) FIXED GLOBAL;
! Makrofall 0106: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0107( Boundary ) FIXED GLOBAL;
! Makrofall 0107: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0108( Boundary ) FIXED GLOBAL;
! Makrofall 0108: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0109( Boundary ) FIXED GLOBAL;
! Makrofall 0109: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0110( Boundary ) FIXED GLOBAL;
! Makrofall 0110: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0111( Boundary ) FIXED GLOBAL;
! Makrofall 0111: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0112( Boundary ) FIXED GLOBAL;
! Makrofall 0112: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0113( Boundary ) FIXED GLOBAL;
! Makrofall 0113: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0114( Boundary ) FIXED GLOBAL;
! Makrofall 0114: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0115( Boundary ) FIXED GLOBAL;
! Makrofall 0115: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0116( Boundary ) FIXED GLOBAL;
! Makrofall 0116: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0117( Boundary ) FIXED GLOBAL;
! Makrofall 0117: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0118( Boundary ) FIXED GLOBAL;
! Makrofall 0118: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0119( Boundary ) FIXED GLOBAL;
! Makrofall 0119: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0120( Boundary ) FIXED GLOBAL;
! Makrofall 0120: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0121( Boundary ) FIXED GLOBAL;
! Makrofall 0121: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0122( Boundary ) FIXED GLOBAL;
! Makrofall 0122: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0123( Boundary ) FIXED GLOBAL;
! Makrofall 0123: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0124( Boundary ) FIXED GLOBAL;
! Makrofall 0124: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0125( Boundary ) FIXED GLOBAL;
! Makrofall 0125: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0126( Boundary ) FIXED GLOBAL;
! Makrofall 0126: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0127( Boundary ) FIXED GLOBAL;
! Makrofall 0127: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0128( Boundary ) FIXED GLOBAL;
! Makrofall 0128: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0129( Boundary ) FIXED GLOBAL;
! Makrofall 0129: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0130( Boundary ) FIXED GLOBAL;
! Makrofall 0130: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0131( Boundary ) FIXED GLOBAL;
! Makrofall 0131: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0132( Boundary ) FIXED GLOBAL;
! Makrofall 0132: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0133( Boundary ) FIXED GLOBAL;
! Makrofall 0133: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0134( Boundary ) FIXED GLOBAL;
! Makrofall 0134: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0135( Boundary ) FIXED GLOBAL;
! Makrofall 0135: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0136( Boundary ) FIXED GLOBAL;
! Makrofall 0136: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0137( Boundary ) FIXED GLOBAL;
! Makrofall 0137: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0138( Boundary ) FIXED GLOBAL;
! Makrofall 0138: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0139( Boundary ) FIXED GLOBAL;
! Makrofall 0139: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0140( Boundary ) FIXED GLOBAL;
! Makrofall 0140: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0141( Boundary ) FIXED GLOBAL;
! Makrofall 0141: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0142( Boundary ) FIXED GLOBAL;
! Makrofall 0142: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0143( Boundary ) FIXED GLOBAL;
! Makrofall 0143: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0144( Boundary ) FIXED GLOBAL;
! Makrofall 0144: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0145( Boundary ) FIXED GLOBAL;
! Makrofall 0145: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0146( Boundary ) FIXED GLOBAL;
! Makrofall 0146: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0147( Boundary ) FIXED GLOBAL;
! Makrofall 0147: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0148( Boundary ) FIXED GLOBAL;
! Makrofall 0148: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0149( Boundary ) FIXED GLOBAL;
! Makrofall 0149: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0150( Boundary ) FIXED GLOBAL;
! Makrofall 0150: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0151( Boundary ) FIXED GLOBAL;
! Makrofall 0151: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0152( Boundary ) FIXED GLOBAL;
! Makrofall 0152: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0153( Boundary ) FIXED GLOBAL;
! Makrofall 0153: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0154( Boundary ) FIXED GLOBAL;
! Makrofall 0154: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0155( Boundary ) FIXED GLOBAL;
! Makrofall 0155: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0156( Boundary ) FIXED GLOBAL;
! Makrofall 0156: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0157( Boundary ) FIXED GLOBAL;
! Makrofall 0157: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0158( Boundary ) FIXED GLOBAL;
! Makrofall 0158: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0159( Boundary ) FIXED GLOBAL;
! Makrofall 0159: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0160( Boundary ) FIXED GLOBAL;
! Makrofall 0160: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0161( Boundary ) FIXED GLOBAL;
! Makrofall 0161: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0162( Boundary ) FIXED GLOBAL;
! Makrofall 0162: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0163( Boundary ) FIXED GLOBAL;
! Makrofall 0163: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0164( Boundary ) FIXED GLOBAL;
! Makrofall 0164: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0165( Boundary ) FIXED GLOBAL;
! Makrofall 0165: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0166( Boundary ) FIXED GLOBAL;
! Makrofall 0166: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0167( Boundary ) FIXED GLOBAL;
! Makrofall 0167: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0168( Boundary ) FIXED GLOBAL;
! Makrofall 0168: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0169( Boundary ) FIXED GLOBAL;
! Makrofall 0169: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0170( Boundary ) FIXED GLOBAL;
! Makrofall 0170: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0171( Boundary ) FIXED GLOBAL;
! Makrofall 0171: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0172( Boundary ) FIXED GLOBAL;
! Makrofall 0172: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0173( Boundary ) FIXED GLOBAL;
! Makrofall 0173: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0174( Boundary ) FIXED GLOBAL;
! Makrofall 0174: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0175( Boundary ) FIXED GLOBAL;
! Makrofall 0175: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0176( Boundary ) FIXED GLOBAL;
! Makrofall 0176: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0177( Boundary ) FIXED GLOBAL;
! Makrofall 0177: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0178( Boundary ) FIXED GLOBAL;
! Makrofall 0178: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0179( Boundary ) FIXED GLOBAL;
! Makrofall 0179: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0180( Boundary ) FIXED GLOBAL;
! Makrofall 0180: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0181( Boundary ) FIXED GLOBAL;
! Makrofall 0181: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0182( Boundary ) FIXED GLOBAL;
! Makrofall 0182: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0183( Boundary ) FIXED GLOBAL;
! Makrofall 0183: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0184( Boundary ) FIXED GLOBAL;
! Makrofall 0184: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0185( Boundary ) FIXED GLOBAL;
! Makrofall 0185: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0186( Boundary ) FIXED GLOBAL;
! Makrofall 0186: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0187( Boundary ) FIXED GLOBAL;
! Makrofall 0187: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0188( Boundary ) FIXED GLOBAL;
! Makrofall 0188: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0189( Boundary ) FIXED GLOBAL;
! Makrofall 0189: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0190( Boundary ) FIXED GLOBAL;
! Makrofall 0190: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0191( Boundary ) FIXED GLOBAL;
! Makrofall 0191: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0192( Boundary ) FIXED GLOBAL;
! Makrofall 0192: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0193( Boundary ) FIXED GLOBAL;
! Makrofall 0193: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0194( Boundary ) FIXED GLOBAL;
! Makrofall 0194: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0195( Boundary ) FIXED GLOBAL;
! Makrofall 0195: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0196( Boundary ) FIXED GLOBAL;
! Makrofall 0196: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0197( Boundary ) FIXED GLOBAL;
! Makrofall 0197: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0198( Boundary ) FIXED GLOBAL;
! Makrofall 0198: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0199( Boundary ) FIXED GLOBAL;
! Makrofall 0199: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0200( Boundary ) FIXED GLOBAL;
! Makrofall 0200: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0201( Boundary ) FIXED GLOBAL;
! Makrofall 0201: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0202( Boundary ) FIXED GLOBAL;
! Makrofall 0202: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0203( Boundary ) FIXED GLOBAL;
! Makrofall 0203: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0204( Boundary ) FIXED GLOBAL;
! Makrofall 0204: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0205( Boundary ) FIXED GLOBAL;
! Makrofall 0205: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0206( Boundary ) FIXED GLOBAL;
! Makrofall 0206: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0207( Boundary ) FIXED GLOBAL;
! Makrofall 0207: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0208( Boundary ) FIXED GLOBAL;
! Makrofall 0208: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0209( Boundary ) FIXED GLOBAL;
! Makrofall 0209: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0210( Boundary ) FIXED GLOBAL;
! Makrofall 0210: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0211( Boundary ) FIXED GLOBAL;
! Makrofall 0211: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0212( Boundary ) FIXED GLOBAL;
! Makrofall 0212: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0213( Boundary ) FIXED GLOBAL;
! Makrofall 0213: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0214( Boundary ) FIXED GLOBAL;
! Makrofall 0214: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0215( Boundary ) FIXED GLOBAL;
! Makrofall 0215: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0216( Boundary ) FIXED GLOBAL;
! Makrofall 0216: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0217( Boundary ) FIXED GLOBAL;
! Makrofall 0217: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0218( Boundary ) FIXED GLOBAL;
! Makrofall 0218: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0219( Boundary ) FIXED GLOBAL;
! Makrofall 0219: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0220( Boundary ) FIXED GLOBAL;
! Makrofall 0220: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0221( Boundary ) FIXED GLOBAL;
! Makrofall 0221: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0222( Boundary ) FIXED GLOBAL;
! Makrofall 0222: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0223( Boundary ) FIXED GLOBAL;
! Makrofall 0223: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0224( Boundary ) FIXED GLOBAL;
! Makrofall 0224: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0225( Boundary ) FIXED GLOBAL;
! Makrofall 0225: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0226( Boundary ) FIXED GLOBAL;
! Makrofall 0226: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0227( Boundary ) FIXED GLOBAL;
! Makrofall 0227: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0228( Boundary ) FIXED GLOBAL;
! Makrofall 0228: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0229( Boundary ) FIXED GLOBAL;
! Makrofall 0229: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0230( Boundary ) FIXED GLOBAL;
! Makrofall 0230: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0231( Boundary ) FIXED GLOBAL;
! Makrofall 0231: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0232( Boundary ) FIXED GLOBAL;
! Makrofall 0232: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0233( Boundary ) FIXED GLOBAL;
! Makrofall 0233: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0234( Boundary ) FIXED GLOBAL;
! Makrofall 0234: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0235( Boundary ) FIXED GLOBAL;
! Makrofall 0235: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0236( Boundary ) FIXED GLOBAL;
! Makrofall 0236: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0237( Boundary ) FIXED GLOBAL;
! Makrofall 0237: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0238( Boundary ) FIXED GLOBAL;
! Makrofall 0238: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0239( Boundary ) FIXED GLOBAL;
! Makrofall 0239: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0240( Boundary ) FIXED GLOBAL;
! Makrofall 0240: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0241( Boundary ) FIXED GLOBAL;
! Makrofall 0241: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0242( Boundary ) FIXED GLOBAL;
! Makrofall 0242: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0243( Boundary ) FIXED GLOBAL;
! Makrofall 0243: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0244( Boundary ) FIXED GLOBAL;
! Makrofall 0244: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0245( Boundary ) FIXED GLOBAL;
! Makrofall 0245: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0246( Boundary ) FIXED GLOBAL;
! Makrofall 0246: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0247( Boundary ) FIXED GLOBAL;
! Makrofall 0247: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0248( Boundary ) FIXED GLOBAL;
! Makrofall 0248: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0249( Boundary ) FIXED GLOBAL;
! Makrofall 0249: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0250( Boundary ) FIXED GLOBAL;
! Makrofall 0250: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0251( Boundary ) FIXED GLOBAL;
! Makrofall 0251: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0252( Boundary ) FIXED GLOBAL;
! Makrofall 0252: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0253( Boundary ) FIXED GLOBAL;
! Makrofall 0253: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0254( Boundary ) FIXED GLOBAL;
! Makrofall 0254: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0255( Boundary ) FIXED GLOBAL;
! Makrofall 0255: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0256( Boundary ) FIXED GLOBAL;
! Makrofall 0256: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0257( Boundary ) FIXED GLOBAL;
! Makrofall 0257: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0258( Boundary ) FIXED GLOBAL;
! Makrofall 0258: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0259( Boundary ) FIXED GLOBAL;
! Makrofall 0259: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0260( Boundary ) FIXED GLOBAL;
! Makrofall 0260: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0261( Boundary ) FIXED GLOBAL;
! Makrofall 0261: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0262( Boundary ) FIXED GLOBAL;
! Makrofall 0262: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0263( Boundary ) FIXED GLOBAL;
! Makrofall 0263: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0264( Boundary ) FIXED GLOBAL;
! Makrofall 0264: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0265( Boundary ) FIXED GLOBAL;
! Makrofall 0265: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0266( Boundary ) FIXED GLOBAL;
! Makrofall 0266: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0267( Boundary ) FIXED GLOBAL;
! Makrofall 0267: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0268( Boundary ) FIXED GLOBAL;
! Makrofall 0268: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0269( Boundary ) FIXED GLOBAL;
! Makrofall 0269: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0270( Boundary ) FIXED GLOBAL;
! Makrofall 0270: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0271( Boundary ) FIXED GLOBAL;
! Makrofall 0271: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0272( Boundary ) FIXED GLOBAL;
! Makrofall 0272: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0273( Boundary ) FIXED GLOBAL;
! Makrofall 0273: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0274( Boundary ) FIXED GLOBAL;
! Makrofall 0274: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0275( Boundary ) FIXED GLOBAL;
! Makrofall 0275: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0276( Boundary ) FIXED GLOBAL;
! Makrofall 0276: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0277( Boundary ) FIXED GLOBAL;
! Makrofall 0277: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0278( Boundary ) FIXED GLOBAL;
! Makrofall 0278: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0279( Boundary ) FIXED GLOBAL;
! Makrofall 0279: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0280( Boundary ) FIXED GLOBAL;
! Makrofall 0280: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0281( Boundary ) FIXED GLOBAL;
! Makrofall 0281: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0282( Boundary ) FIXED GLOBAL;
! Makrofall 0282: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0283( Boundary ) FIXED GLOBAL;
! Makrofall 0283: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0284( Boundary ) FIXED GLOBAL;
! Makrofall 0284: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0285( Boundary ) FIXED GLOBAL;
! Makrofall 0285: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0286( Boundary ) FIXED GLOBAL;
! Makrofall 0286: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0287( Boundary ) FIXED GLOBAL;
! Makrofall 0287: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0288( Boundary ) FIXED GLOBAL;
! Makrofall 0288: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0289( Boundary ) FIXED GLOBAL;
! Makrofall 0289: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0290( Boundary ) FIXED GLOBAL;
! Makrofall 0290: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0291( Boundary ) FIXED GLOBAL;
! Makrofall 0291: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0292( Boundary ) FIXED GLOBAL;
! Makrofall 0292: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0293( Boundary ) FIXED GLOBAL;
! Makrofall 0293: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0294( Boundary ) FIXED GLOBAL;
! Makrofall 0294: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0295( Boundary ) FIXED GLOBAL;
! Makrofall 0295: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0296( Boundary ) FIXED GLOBAL;
! Makrofall 0296: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0297( Boundary ) FIXED GLOBAL;
! Makrofall 0297: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0298( Boundary ) FIXED GLOBAL;
! Makrofall 0298: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0299( Boundary ) FIXED GLOBAL;
! Makrofall 0299: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0300( Boundary ) FIXED GLOBAL;
! Makrofall 0300: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0301( Boundary ) FIXED GLOBAL;
! Makrofall 0301: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0302( Boundary ) FIXED GLOBAL;
! Makrofall 0302: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0303( Boundary ) FIXED GLOBAL;
! Makrofall 0303: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0304( Boundary ) FIXED GLOBAL;
! Makrofall 0304: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0305( Boundary ) FIXED GLOBAL;
! Makrofall 0305: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0306( Boundary ) FIXED GLOBAL;
! Makrofall 0306: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0307( Boundary ) FIXED GLOBAL;
! Makrofall 0307: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0308( Boundary ) FIXED GLOBAL;
! Makrofall 0308: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0309( Boundary ) FIXED GLOBAL;
! Makrofall 0309: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0310( Boundary ) FIXED GLOBAL;
! Makrofall 0310: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0311( Boundary ) FIXED GLOBAL;
! Makrofall 0311: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0312( Boundary ) FIXED GLOBAL;
! Makrofall 0312: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0313( Boundary ) FIXED GLOBAL;
! Makrofall 0313: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0314( Boundary ) FIXED GLOBAL;
! Makrofall 0314: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0315( Boundary ) FIXED GLOBAL;
! Makrofall 0315: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0316( Boundary ) FIXED GLOBAL;
! Makrofall 0316: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0317( Boundary ) FIXED GLOBAL;
! Makrofall 0317: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0318( Boundary ) FIXED GLOBAL;
! Makrofall 0318: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0319( Boundary ) FIXED GLOBAL;
! Makrofall 0319: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0320( Boundary ) FIXED GLOBAL;
! Makrofall 0320: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0321( Boundary ) FIXED GLOBAL;
! Makrofall 0321: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0322( Boundary ) FIXED GLOBAL;
! Makrofall 0322: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0323( Boundary ) FIXED GLOBAL;
! Makrofall 0323: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0324( Boundary ) FIXED GLOBAL;
! Makrofall 0324: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0325( Boundary ) FIXED GLOBAL;
! Makrofall 0325: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0326( Boundary ) FIXED GLOBAL;
! Makrofall 0326: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0327( Boundary ) FIXED GLOBAL;
! Makrofall 0327: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0328( Boundary ) FIXED GLOBAL;
! Makrofall 0328: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0329( Boundary ) FIXED GLOBAL;
! Makrofall 0329: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0330( Boundary ) FIXED GLOBAL;
! Makrofall 0330: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0331( Boundary ) FIXED GLOBAL;
! Makrofall 0331: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0332( Boundary ) FIXED GLOBAL;
! Makrofall 0332: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0333( Boundary ) FIXED GLOBAL;
! Makrofall 0333: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0334( Boundary ) FIXED GLOBAL;
! Makrofall 0334: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0335( Boundary ) FIXED GLOBAL;
! Makrofall 0335: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0336( Boundary ) FIXED GLOBAL;
! Makrofall 0336: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0337( Boundary ) FIXED GLOBAL;
! Makrofall 0337: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0338( Boundary ) FIXED GLOBAL;
! Makrofall 0338: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0339( Boundary ) FIXED GLOBAL;
! Makrofall 0339: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0340( Boundary ) FIXED GLOBAL;
! Makrofall 0340: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0341( Boundary ) FIXED GLOBAL;
! Makrofall 0341: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0342( Boundary ) FIXED GLOBAL;
! Makrofall 0342: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0343( Boundary ) FIXED GLOBAL;
! Makrofall 0343: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0344( Boundary ) FIXED GLOBAL;
! Makrofall 0344: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0345( Boundary ) FIXED GLOBAL;
! Makrofall 0345: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0346( Boundary ) FIXED GLOBAL;
! Makrofall 0346: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0347( Boundary ) FIXED GLOBAL;
! Makrofall 0347: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0348( Boundary ) FIXED GLOBAL;
! Makrofall 0348: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0349( Boundary ) FIXED GLOBAL;
! Makrofall 0349: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0350( Boundary ) FIXED GLOBAL;
! Makrofall 0350: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0351( Boundary ) FIXED GLOBAL;
! Makrofall 0351: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0352( Boundary ) FIXED GLOBAL;
! Makrofall 0352: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0353( Boundary ) FIXED GLOBAL;
! Makrofall 0353: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0354( Boundary ) FIXED GLOBAL;
! Makrofall 0354: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0355( Boundary ) FIXED GLOBAL;
! Makrofall 0355: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0356( Boundary ) FIXED GLOBAL;
! Makrofall 0356: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0357( Boundary ) FIXED GLOBAL;
! Makrofall 0357: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0358( Boundary ) FIXED GLOBAL;
! Makrofall 0358: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0359( Boundary ) FIXED GLOBAL;
! Makrofall 0359: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0360( Boundary ) FIXED GLOBAL;
! Makrofall 0360: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0361( Boundary ) FIXED GLOBAL;
! Makrofall 0361: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0362( Boundary ) FIXED GLOBAL;
! Makrofall 0362: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0363( Boundary ) FIXED GLOBAL;
! Makrofall 0363: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0364( Boundary ) FIXED GLOBAL;
! Makrofall 0364: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0365( Boundary ) FIXED GLOBAL;
! Makrofall 0365: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0366( Boundary ) FIXED GLOBAL;
! Makrofall 0366: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0367( Boundary ) FIXED GLOBAL;
! Makrofall 0367: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0368( Boundary ) FIXED GLOBAL;
! Makrofall 0368: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0369( Boundary ) FIXED GLOBAL;
! Makrofall 0369: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0370( Boundary ) FIXED GLOBAL;
! Makrofall 0370: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0371( Boundary ) FIXED GLOBAL;
! Makrofall 0371: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0372( Boundary ) FIXED GLOBAL;
! Makrofall 0372: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0373( Boundary ) FIXED GLOBAL;
! Makrofall 0373: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0374( Boundary ) FIXED GLOBAL;
! Makrofall 0374: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0375( Boundary ) FIXED GLOBAL;
! Makrofall 0375: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0376( Boundary ) FIXED GLOBAL;
! Makrofall 0376: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0377( Boundary ) FIXED GLOBAL;
! Makrofall 0377: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0378( Boundary ) FIXED GLOBAL;
! Makrofall 0378: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0379( Boundary ) FIXED GLOBAL;
! Makrofall 0379: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0380( Boundary ) FIXED GLOBAL;
! Makrofall 0380: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0381( Boundary ) FIXED GLOBAL;
! Makrofall 0381: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0382( Boundary ) FIXED GLOBAL;
! Makrofall 0382: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0383( Boundary ) FIXED GLOBAL;
! Makrofall 0383: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0384( Boundary ) FIXED GLOBAL;
! Makrofall 0384: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0385( Boundary ) FIXED GLOBAL;
! Makrofall 0385: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0386( Boundary ) FIXED GLOBAL;
! Makrofall 0386: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0387( Boundary ) FIXED GLOBAL;
! Makrofall 0387: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0388( Boundary ) FIXED GLOBAL;
! Makrofall 0388: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0389( Boundary ) FIXED GLOBAL;
! Makrofall 0389: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0390( Boundary ) FIXED GLOBAL;
! Makrofall 0390: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0391( Boundary ) FIXED GLOBAL;
! Makrofall 0391: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0392( Boundary ) FIXED GLOBAL;
! Makrofall 0392: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0393( Boundary ) FIXED GLOBAL;
! Makrofall 0393: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0394( Boundary ) FIXED GLOBAL;
! Makrofall 0394: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0395( Boundary ) FIXED GLOBAL;
! Makrofall 0395: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0396( Boundary ) FIXED GLOBAL;
! Makrofall 0396: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0397( Boundary ) FIXED GLOBAL;
! Makrofall 0397: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0398( Boundary ) FIXED GLOBAL;
! Makrofall 0398: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0399( Boundary ) FIXED GLOBAL;
! Makrofall 0399: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0400( Boundary ) FIXED GLOBAL;
! Makrofall 0400: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0401( Boundary ) FIXED GLOBAL;
! Makrofall 0401: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0402( Boundary ) FIXED GLOBAL;
! Makrofall 0402: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0403( Boundary ) FIXED GLOBAL;
! Makrofall 0403: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0404( Boundary ) FIXED GLOBAL;
! Makrofall 0404: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0405( Boundary ) FIXED GLOBAL;
! Makrofall 0405: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0406( Boundary ) FIXED GLOBAL;
! Makrofall 0406: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0407( Boundary ) FIXED GLOBAL;
! Makrofall 0407: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0408( Boundary ) FIXED GLOBAL;
! Makrofall 0408: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0409( Boundary ) FIXED GLOBAL;
! Makrofall 0409: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0410( Boundary ) FIXED GLOBAL;
! Makrofall 0410: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0411( Boundary ) FIXED GLOBAL;
! Makrofall 0411: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0412( Boundary ) FIXED GLOBAL;
! Makrofall 0412: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0413( Boundary ) FIXED GLOBAL;
! Makrofall 0413: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0414( Boundary ) FIXED GLOBAL;
! Makrofall 0414: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0415( Boundary ) FIXED GLOBAL;
! Makrofall 0415: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0416( Boundary ) FIXED GLOBAL;
! Makrofall 0416: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0417( Boundary ) FIXED GLOBAL;
! Makrofall 0417: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0418( Boundary ) FIXED GLOBAL;
! Makrofall 0418: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0419( Boundary ) FIXED GLOBAL;
! Makrofall 0419: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0420( Boundary ) FIXED GLOBAL;
! Makrofall 0420: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0421( Boundary ) FIXED GLOBAL;
! Makrofall 0421: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0422( Boundary ) FIXED GLOBAL;
! Makrofall 0422: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0423( Boundary ) FIXED GLOBAL;
! Makrofall 0423: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0424( Boundary ) FIXED GLOBAL;
! Makrofall 0424: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0425( Boundary ) FIXED GLOBAL;
! Makrofall 0425: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0426( Boundary ) FIXED GLOBAL;
! Makrofall 0426: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0427( Boundary ) FIXED GLOBAL;
! Makrofall 0427: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0428( Boundary ) FIXED GLOBAL;
! Makrofall 0428: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0429( Boundary ) FIXED GLOBAL;
! Makrofall 0429: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0430( Boundary ) FIXED GLOBAL;
! Makrofall 0430: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0431( Boundary ) FIXED GLOBAL;
! Makrofall 0431: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0432( Boundary ) FIXED GLOBAL;
! Makrofall 0432: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0433( Boundary ) FIXED GLOBAL;
! Makrofall 0433: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0434( Boundary ) FIXED GLOBAL;
! Makrofall 0434: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0435( Boundary ) FIXED GLOBAL;
! Makrofall 0435: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0436( Boundary ) FIXED GLOBAL;
! Makrofall 0436: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0437( Boundary ) FIXED GLOBAL;
! Makrofall 0437: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0438( Boundary ) FIXED GLOBAL;
! Makrofall 0438: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0439( Boundary ) FIXED GLOBAL;
! Makrofall 0439: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0440( Boundary ) FIXED GLOBAL;
! Makrofall 0440: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0441( Boundary ) FIXED GLOBAL;
! Makrofall 0441: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0442( Boundary ) FIXED GLOBAL;
! Makrofall 0442: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0443( Boundary ) FIXED GLOBAL;
! Makrofall 0443: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0444( Boundary ) FIXED GLOBAL;
! Makrofall 0444: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0445( Boundary ) FIXED GLOBAL;
! Makrofall 0445: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0446( Boundary ) FIXED GLOBAL;
! Makrofall 0446: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0447( Boundary ) FIXED GLOBAL;
! Makrofall 0447: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0448( Boundary ) FIXED GLOBAL;
! Makrofall 0448: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0449( Boundary ) FIXED GLOBAL;
! Makrofall 0449: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0450( Boundary ) FIXED GLOBAL;
! Makrofall 0450: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0451( Boundary ) FIXED GLOBAL;
! Makrofall 0451: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0452( Boundary ) FIXED GLOBAL;
! Makrofall 0452: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0453( Boundary ) FIXED GLOBAL;
! Makrofall 0453: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0454( Boundary ) FIXED GLOBAL;
! Makrofall 0454: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0455( Boundary ) FIXED GLOBAL;
! Makrofall 0455: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0456( Boundary ) FIXED GLOBAL;
! Makrofall 0456: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0457( Boundary ) FIXED GLOBAL;
! Makrofall 0457: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0458( Boundary ) FIXED GLOBAL;
! Makrofall 0458: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0459( Boundary ) FIXED GLOBAL;
! Makrofall 0459: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0460( Boundary ) FIXED GLOBAL;
! Makrofall 0460: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0461( Boundary ) FIXED GLOBAL;
! Makrofall 0461: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0462( Boundary ) FIXED GLOBAL;
! Makrofall 0462: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0463( Boundary ) FIXED GLOBAL;
! Makrofall 0463: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0464( Boundary ) FIXED GLOBAL;
! Makrofall 0464: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0465( Boundary ) FIXED GLOBAL;
! Makrofall 0465: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0466( Boundary ) FIXED GLOBAL;
! Makrofall 0466: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0467( Boundary ) FIXED GLOBAL;
! Makrofall 0467: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0468( Boundary ) FIXED GLOBAL;
! Makrofall 0468: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0469( Boundary ) FIXED GLOBAL;
! Makrofall 0469: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0470( Boundary ) FIXED GLOBAL;
! Makrofall 0470: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0471( Boundary ) FIXED GLOBAL;
! Makrofall 0471: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0472( Boundary ) FIXED GLOBAL;
! Makrofall 0472: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0473( Boundary ) FIXED GLOBAL;
! Makrofall 0473: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0474( Boundary ) FIXED GLOBAL;
! Makrofall 0474: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0475( Boundary ) FIXED GLOBAL;
! Makrofall 0475: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0476( Boundary ) FIXED GLOBAL;
! Makrofall 0476: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0477( Boundary ) FIXED GLOBAL;
! Makrofall 0477: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0478( Boundary ) FIXED GLOBAL;
! Makrofall 0478: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0479( Boundary ) FIXED GLOBAL;
! Makrofall 0479: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0480( Boundary ) FIXED GLOBAL;
! Makrofall 0480: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0481( Boundary ) FIXED GLOBAL;
! Makrofall 0481: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0482( Boundary ) FIXED GLOBAL;
! Makrofall 0482: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0483( Boundary ) FIXED GLOBAL;
! Makrofall 0483: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0484( Boundary ) FIXED GLOBAL;
! Makrofall 0484: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0485( Boundary ) FIXED GLOBAL;
! Makrofall 0485: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0486( Boundary ) FIXED GLOBAL;
! Makrofall 0486: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0487( Boundary ) FIXED GLOBAL;
! Makrofall 0487: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0488( Boundary ) FIXED GLOBAL;
! Makrofall 0488: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0489( Boundary ) FIXED GLOBAL;
! Makrofall 0489: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0490( Boundary ) FIXED GLOBAL;
! Makrofall 0490: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0491( Boundary ) FIXED GLOBAL;
! Makrofall 0491: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0492( Boundary ) FIXED GLOBAL;
! Makrofall 0492: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0493( Boundary ) FIXED GLOBAL;
! Makrofall 0493: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0494( Boundary ) FIXED GLOBAL;
! Makrofall 0494: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0495( Boundary ) FIXED GLOBAL;
! Makrofall 0495: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0496( Boundary ) FIXED GLOBAL;
! Makrofall 0496: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0497( Boundary ) FIXED GLOBAL;
! Makrofall 0497: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0498( Boundary ) FIXED GLOBAL;
! Makrofall 0498: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0499( Boundary ) FIXED GLOBAL;
! Makrofall 0499: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0500( Boundary ) FIXED GLOBAL;
! Makrofall 0500: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0501( Boundary ) FIXED GLOBAL;
! Makrofall 0501: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0502( Boundary ) FIXED GLOBAL;
! Makrofall 0502: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0503( Boundary ) FIXED GLOBAL;
! Makrofall 0503: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0504( Boundary ) FIXED GLOBAL;
! Makrofall 0504: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0505( Boundary ) FIXED GLOBAL;
! Makrofall 0505: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0506( Boundary ) FIXED GLOBAL;
! Makrofall 0506: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0507( Boundary ) FIXED GLOBAL;
! Makrofall 0507: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0508( Boundary ) FIXED GLOBAL;
! Makrofall 0508: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0509( Boundary ) FIXED GLOBAL;
! Makrofall 0509: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0510( Boundary ) FIXED GLOBAL;
! Makrofall 0510: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0511( Boundary ) FIXED GLOBAL;
! Makrofall 0511: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0512( Boundary ) FIXED GLOBAL;
! Makrofall 0512: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0513( Boundary ) FIXED GLOBAL;
! Makrofall 0513: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0514( Boundary ) FIXED GLOBAL;
! Makrofall 0514: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0515( Boundary ) FIXED GLOBAL;
! Makrofall 0515: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0516( Boundary ) FIXED GLOBAL;
! Makrofall 0516: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0517( Boundary ) FIXED GLOBAL;
! Makrofall 0517: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0518( Boundary ) FIXED GLOBAL;
! Makrofall 0518: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0519( Boundary ) FIXED GLOBAL;
! Makrofall 0519: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0520( Boundary ) FIXED GLOBAL;
! Makrofall 0520: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0521( Boundary ) FIXED GLOBAL;
! Makrofall 0521: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0522( Boundary ) FIXED GLOBAL;
! Makrofall 0522: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0523( Boundary ) FIXED GLOBAL;
! Makrofall 0523: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0524( Boundary ) FIXED GLOBAL;
! Makrofall 0524: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0525( Boundary ) FIXED GLOBAL;
! Makrofall 0525: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0526( Boundary ) FIXED GLOBAL;
! Makrofall 0526: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0527( Boundary ) FIXED GLOBAL;
! Makrofall 0527: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0528( Boundary ) FIXED GLOBAL;
! Makrofall 0528: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0529( Boundary ) FIXED GLOBAL;
! Makrofall 0529: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0530( Boundary ) FIXED GLOBAL;
! Makrofall 0530: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0531( Boundary ) FIXED GLOBAL;
! Makrofall 0531: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0532( Boundary ) FIXED GLOBAL;
! Makrofall 0532: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0533( Boundary ) FIXED GLOBAL;
! Makrofall 0533: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0534( Boundary ) FIXED GLOBAL;
! Makrofall 0534: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0535( Boundary ) FIXED GLOBAL;
! Makrofall 0535: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0536( Boundary ) FIXED GLOBAL;
! Makrofall 0536: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0537( Boundary ) FIXED GLOBAL;
! Makrofall 0537: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0538( Boundary ) FIXED GLOBAL;
! Makrofall 0538: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0539( Boundary ) FIXED GLOBAL;
! Makrofall 0539: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0540( Boundary ) FIXED GLOBAL;
! Makrofall 0540: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0541( Boundary ) FIXED GLOBAL;
! Makrofall 0541: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0542( Boundary ) FIXED GLOBAL;
! Makrofall 0542: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0543( Boundary ) FIXED GLOBAL;
! Makrofall 0543: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0544( Boundary ) FIXED GLOBAL;
! Makrofall 0544: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0545( Boundary ) FIXED GLOBAL;
! Makrofall 0545: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0546( Boundary ) FIXED GLOBAL;
! Makrofall 0546: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0547( Boundary ) FIXED GLOBAL;
! Makrofall 0547: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0548( Boundary ) FIXED GLOBAL;
! Makrofall 0548: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0549( Boundary ) FIXED GLOBAL;
! Makrofall 0549: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0550( Boundary ) FIXED GLOBAL;
! Makrofall 0550: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0551( Boundary ) FIXED GLOBAL;
! Makrofall 0551: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0552( Boundary ) FIXED GLOBAL;
! Makrofall 0552: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0553( Boundary ) FIXED GLOBAL;
! Makrofall 0553: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0554( Boundary ) FIXED GLOBAL;
! Makrofall 0554: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0555( Boundary ) FIXED GLOBAL;
! Makrofall 0555: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0556( Boundary ) FIXED GLOBAL;
! Makrofall 0556: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0557( Boundary ) FIXED GLOBAL;
! Makrofall 0557: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0558( Boundary ) FIXED GLOBAL;
! Makrofall 0558: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0559( Boundary ) FIXED GLOBAL;
! Makrofall 0559: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0560( Boundary ) FIXED GLOBAL;
! Makrofall 0560: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0561( Boundary ) FIXED GLOBAL;
! Makrofall 0561: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0562( Boundary ) FIXED GLOBAL;
! Makrofall 0562: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0563( Boundary ) FIXED GLOBAL;
! Makrofall 0563: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0564( Boundary ) FIXED GLOBAL;
! Makrofall 0564: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0565( Boundary ) FIXED GLOBAL;
! Makrofall 0565: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0566( Boundary ) FIXED GLOBAL;
! Makrofall 0566: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0567( Boundary ) FIXED GLOBAL;
! Makrofall 0567: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0568( Boundary ) FIXED GLOBAL;
! Makrofall 0568: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0569( Boundary ) FIXED GLOBAL;
! Makrofall 0569: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0570( Boundary ) FIXED GLOBAL;
! Makrofall 0570: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0571( Boundary ) FIXED GLOBAL;
! Makrofall 0571: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0572( Boundary ) FIXED GLOBAL;
! Makrofall 0572: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0573( Boundary ) FIXED GLOBAL;
! Makrofall 0573: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0574( Boundary ) FIXED GLOBAL;
! Makrofall 0574: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0575( Boundary ) FIXED GLOBAL;
! Makrofall 0575: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0576( Boundary ) FIXED GLOBAL;
! Makrofall 0576: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0577( Boundary ) FIXED GLOBAL;
! Makrofall 0577: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0578( Boundary ) FIXED GLOBAL;
! Makrofall 0578: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0579( Boundary ) FIXED GLOBAL;
! Makrofall 0579: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0580( Boundary ) FIXED GLOBAL;
! Makrofall 0580: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0581( Boundary ) FIXED GLOBAL;
! Makrofall 0581: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0582( Boundary ) FIXED GLOBAL;
! Makrofall 0582: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0583( Boundary ) FIXED GLOBAL;
! Makrofall 0583: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0584( Boundary ) FIXED GLOBAL;
! Makrofall 0584: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0585( Boundary ) FIXED GLOBAL;
! Makrofall 0585: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0586( Boundary ) FIXED GLOBAL;
! Makrofall 0586: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0587( Boundary ) FIXED GLOBAL;
! Makrofall 0587: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0588( Boundary ) FIXED GLOBAL;
! Makrofall 0588: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0589( Boundary ) FIXED GLOBAL;
! Makrofall 0589: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0590( Boundary ) FIXED GLOBAL;
! Makrofall 0590: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0591( Boundary ) FIXED GLOBAL;
! Makrofall 0591: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0592( Boundary ) FIXED GLOBAL;
! Makrofall 0592: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0593( Boundary ) FIXED GLOBAL;
! Makrofall 0593: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0594( Boundary ) FIXED GLOBAL;
! Makrofall 0594: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0595( Boundary ) FIXED GLOBAL;
! Makrofall 0595: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0596( Boundary ) FIXED GLOBAL;
! Makrofall 0596: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0597( Boundary ) FIXED GLOBAL;
! Makrofall 0597: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0598( Boundary ) FIXED GLOBAL;
! Makrofall 0598: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0599( Boundary ) FIXED GLOBAL;
! Makrofall 0599: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0600( Boundary ) FIXED GLOBAL;
! Makrofall 0600: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0601( Boundary ) FIXED GLOBAL;
! Makrofall 0601: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0602( Boundary ) FIXED GLOBAL;
! Makrofall 0602: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0603( Boundary ) FIXED GLOBAL;
! Makrofall 0603: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0604( Boundary ) FIXED GLOBAL;
! Makrofall 0604: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0605( Boundary ) FIXED GLOBAL;
! Makrofall 0605: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0606( Boundary ) FIXED GLOBAL;
! Makrofall 0606: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0607( Boundary ) FIXED GLOBAL;
! Makrofall 0607: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0608( Boundary ) FIXED GLOBAL;
! Makrofall 0608: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0609( Boundary ) FIXED GLOBAL;
! Makrofall 0609: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0610( Boundary ) FIXED GLOBAL;
! Makrofall 0610: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0611( Boundary ) FIXED GLOBAL;
! Makrofall 0611: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0612( Boundary ) FIXED GLOBAL;
! Makrofall 0612: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0613( Boundary ) FIXED GLOBAL;
! Makrofall 0613: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0614( Boundary ) FIXED GLOBAL;
! Makrofall 0614: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0615( Boundary ) FIXED GLOBAL;
! Makrofall 0615: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0616( Boundary ) FIXED GLOBAL;
! Makrofall 0616: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0617( Boundary ) FIXED GLOBAL;
! Makrofall 0617: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0618( Boundary ) FIXED GLOBAL;
! Makrofall 0618: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0619( Boundary ) FIXED GLOBAL;
! Makrofall 0619: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0620( Boundary ) FIXED GLOBAL;
! Makrofall 0620: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0621( Boundary ) FIXED GLOBAL;
! Makrofall 0621: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0622( Boundary ) FIXED GLOBAL;
! Makrofall 0622: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0623( Boundary ) FIXED GLOBAL;
! Makrofall 0623: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0624( Boundary ) FIXED GLOBAL;
! Makrofall 0624: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0625( Boundary ) FIXED GLOBAL;
! Makrofall 0625: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0626( Boundary ) FIXED GLOBAL;
! Makrofall 0626: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0627( Boundary ) FIXED GLOBAL;
! Makrofall 0627: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0628( Boundary ) FIXED GLOBAL;
! Makrofall 0628: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0629( Boundary ) FIXED GLOBAL;
! Makrofall 0629: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0630( Boundary ) FIXED GLOBAL;
! Makrofall 0630: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0631( Boundary ) FIXED GLOBAL;
! Makrofall 0631: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0632( Boundary ) FIXED GLOBAL;
! Makrofall 0632: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0633( Boundary ) FIXED GLOBAL;
! Makrofall 0633: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0634( Boundary ) FIXED GLOBAL;
! Makrofall 0634: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0635( Boundary ) FIXED GLOBAL;
! Makrofall 0635: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0636( Boundary ) FIXED GLOBAL;
! Makrofall 0636: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0637( Boundary ) FIXED GLOBAL;
! Makrofall 0637: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0638( Boundary ) FIXED GLOBAL;
! Makrofall 0638: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0639( Boundary ) FIXED GLOBAL;
! Makrofall 0639: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0640( Boundary ) FIXED GLOBAL;
! Makrofall 0640: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0641( Boundary ) FIXED GLOBAL;
! Makrofall 0641: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0642( Boundary ) FIXED GLOBAL;
! Makrofall 0642: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0643( Boundary ) FIXED GLOBAL;
! Makrofall 0643: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0644( Boundary ) FIXED GLOBAL;
! Makrofall 0644: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0645( Boundary ) FIXED GLOBAL;
! Makrofall 0645: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0646( Boundary ) FIXED GLOBAL;
! Makrofall 0646: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0647( Boundary ) FIXED GLOBAL;
! Makrofall 0647: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0648( Boundary ) FIXED GLOBAL;
! Makrofall 0648: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0649( Boundary ) FIXED GLOBAL;
! Makrofall 0649: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0650( Boundary ) FIXED GLOBAL;
! Makrofall 0650: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0651( Boundary ) FIXED GLOBAL;
! Makrofall 0651: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0652( Boundary ) FIXED GLOBAL;
! Makrofall 0652: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0653( Boundary ) FIXED GLOBAL;
! Makrofall 0653: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0654( Boundary ) FIXED GLOBAL;
! Makrofall 0654: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0655( Boundary ) FIXED GLOBAL;
! Makrofall 0655: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0656( Boundary ) FIXED GLOBAL;
! Makrofall 0656: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0657( Boundary ) FIXED GLOBAL;
! Makrofall 0657: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0658( Boundary ) FIXED GLOBAL;
! Makrofall 0658: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0659( Boundary ) FIXED GLOBAL;
! Makrofall 0659: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0660( Boundary ) FIXED GLOBAL;
! Makrofall 0660: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0661( Boundary ) FIXED GLOBAL;
! Makrofall 0661: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0662( Boundary ) FIXED GLOBAL;
! Makrofall 0662: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0663( Boundary ) FIXED GLOBAL;
! Makrofall 0663: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0664( Boundary ) FIXED GLOBAL;
! Makrofall 0664: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0665( Boundary ) FIXED GLOBAL;
! Makrofall 0665: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0666( Boundary ) FIXED GLOBAL;
! Makrofall 0666: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0667( Boundary ) FIXED GLOBAL;
! Makrofall 0667: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0668( Boundary ) FIXED GLOBAL;
! Makrofall 0668: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0669( Boundary ) FIXED GLOBAL;
! Makrofall 0669: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0670( Boundary ) FIXED GLOBAL;
! Makrofall 0670: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0671( Boundary ) FIXED GLOBAL;
! Makrofall 0671: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0672( Boundary ) FIXED GLOBAL;
! Makrofall 0672: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0673( Boundary ) FIXED GLOBAL;
! Makrofall 0673: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0674( Boundary ) FIXED GLOBAL;
! Makrofall 0674: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0675( Boundary ) FIXED GLOBAL;
! Makrofall 0675: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0676( Boundary ) FIXED GLOBAL;
! Makrofall 0676: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0677( Boundary ) FIXED GLOBAL;
! Makrofall 0677: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0678( Boundary ) FIXED GLOBAL;
! Makrofall 0678: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0679( Boundary ) FIXED GLOBAL;
! Makrofall 0679: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0680( Boundary ) FIXED GLOBAL;
! Makrofall 0680: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0681( Boundary ) FIXED GLOBAL;
! Makrofall 0681: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0682( Boundary ) FIXED GLOBAL;
! Makrofall 0682: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0683( Boundary ) FIXED GLOBAL;
! Makrofall 0683: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0684( Boundary ) FIXED GLOBAL;
! Makrofall 0684: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0685( Boundary ) FIXED GLOBAL;
! Makrofall 0685: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0686( Boundary ) FIXED GLOBAL;
! Makrofall 0686: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0687( Boundary ) FIXED GLOBAL;
! Makrofall 0687: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0688( Boundary ) FIXED GLOBAL;
! Makrofall 0688: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0689( Boundary ) FIXED GLOBAL;
! Makrofall 0689: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0690( Boundary ) FIXED GLOBAL;
! Makrofall 0690: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0691( Boundary ) FIXED GLOBAL;
! Makrofall 0691: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0692( Boundary ) FIXED GLOBAL;
! Makrofall 0692: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0693( Boundary ) FIXED GLOBAL;
! Makrofall 0693: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0694( Boundary ) FIXED GLOBAL;
! Makrofall 0694: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0695( Boundary ) FIXED GLOBAL;
! Makrofall 0695: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0696( Boundary ) FIXED GLOBAL;
! Makrofall 0696: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0697( Boundary ) FIXED GLOBAL;
! Makrofall 0697: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0698( Boundary ) FIXED GLOBAL;
! Makrofall 0698: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0699( Boundary ) FIXED GLOBAL;
! Makrofall 0699: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0700( Boundary ) FIXED GLOBAL;
! Makrofall 0700: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0701( Boundary ) FIXED GLOBAL;
! Makrofall 0701: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0702( Boundary ) FIXED GLOBAL;
! Makrofall 0702: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0703( Boundary ) FIXED GLOBAL;
! Makrofall 0703: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0704( Boundary ) FIXED GLOBAL;
! Makrofall 0704: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0705( Boundary ) FIXED GLOBAL;
! Makrofall 0705: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0706( Boundary ) FIXED GLOBAL;
! Makrofall 0706: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0707( Boundary ) FIXED GLOBAL;
! Makrofall 0707: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0708( Boundary ) FIXED GLOBAL;
! Makrofall 0708: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0709( Boundary ) FIXED GLOBAL;
! Makrofall 0709: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0710( Boundary ) FIXED GLOBAL;
! Makrofall 0710: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0711( Boundary ) FIXED GLOBAL;
! Makrofall 0711: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0712( Boundary ) FIXED GLOBAL;
! Makrofall 0712: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0713( Boundary ) FIXED GLOBAL;
! Makrofall 0713: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0714( Boundary ) FIXED GLOBAL;
! Makrofall 0714: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0715( Boundary ) FIXED GLOBAL;
! Makrofall 0715: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0716( Boundary ) FIXED GLOBAL;
! Makrofall 0716: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0717( Boundary ) FIXED GLOBAL;
! Makrofall 0717: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0718( Boundary ) FIXED GLOBAL;
! Makrofall 0718: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0719( Boundary ) FIXED GLOBAL;
! Makrofall 0719: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0720( Boundary ) FIXED GLOBAL;
! Makrofall 0720: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0721( Boundary ) FIXED GLOBAL;
! Makrofall 0721: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0722( Boundary ) FIXED GLOBAL;
! Makrofall 0722: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0723( Boundary ) FIXED GLOBAL;
! Makrofall 0723: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0724( Boundary ) FIXED GLOBAL;
! Makrofall 0724: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0725( Boundary ) FIXED GLOBAL;
! Makrofall 0725: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0726( Boundary ) FIXED GLOBAL;
! Makrofall 0726: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0727( Boundary ) FIXED GLOBAL;
! Makrofall 0727: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0728( Boundary ) FIXED GLOBAL;
! Makrofall 0728: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0729( Boundary ) FIXED GLOBAL;
! Makrofall 0729: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0730( Boundary ) FIXED GLOBAL;
! Makrofall 0730: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0731( Boundary ) FIXED GLOBAL;
! Makrofall 0731: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0732( Boundary ) FIXED GLOBAL;
! Makrofall 0732: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0733( Boundary ) FIXED GLOBAL;
! Makrofall 0733: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0734( Boundary ) FIXED GLOBAL;
! Makrofall 0734: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0735( Boundary ) FIXED GLOBAL;
! Makrofall 0735: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0736( Boundary ) FIXED GLOBAL;
! Makrofall 0736: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0737( Boundary ) FIXED GLOBAL;
! Makrofall 0737: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0738( Boundary ) FIXED GLOBAL;
! Makrofall 0738: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0739( Boundary ) FIXED GLOBAL;
! Makrofall 0739: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0740( Boundary ) FIXED GLOBAL;
! Makrofall 0740: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0741( Boundary ) FIXED GLOBAL;
! Makrofall 0741: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0742( Boundary ) FIXED GLOBAL;
! Makrofall 0742: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0743( Boundary ) FIXED GLOBAL;
! Makrofall 0743: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0744( Boundary ) FIXED GLOBAL;
! Makrofall 0744: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0745( Boundary ) FIXED GLOBAL;
! Makrofall 0745: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0746( Boundary ) FIXED GLOBAL;
! Makrofall 0746: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0747( Boundary ) FIXED GLOBAL;
! Makrofall 0747: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0748( Boundary ) FIXED GLOBAL;
! Makrofall 0748: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0749( Boundary ) FIXED GLOBAL;
! Makrofall 0749: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0750( Boundary ) FIXED GLOBAL;
! Makrofall 0750: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0751( Boundary ) FIXED GLOBAL;
! Makrofall 0751: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0752( Boundary ) FIXED GLOBAL;
! Makrofall 0752: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0753( Boundary ) FIXED GLOBAL;
! Makrofall 0753: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0754( Boundary ) FIXED GLOBAL;
! Makrofall 0754: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0755( Boundary ) FIXED GLOBAL;
! Makrofall 0755: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0756( Boundary ) FIXED GLOBAL;
! Makrofall 0756: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0757( Boundary ) FIXED GLOBAL;
! Makrofall 0757: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0758( Boundary ) FIXED GLOBAL;
! Makrofall 0758: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0759( Boundary ) FIXED GLOBAL;
! Makrofall 0759: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0760( Boundary ) FIXED GLOBAL;
! Makrofall 0760: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0761( Boundary ) FIXED GLOBAL;
! Makrofall 0761: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0762( Boundary ) FIXED GLOBAL;
! Makrofall 0762: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0763( Boundary ) FIXED GLOBAL;
! Makrofall 0763: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0764( Boundary ) FIXED GLOBAL;
! Makrofall 0764: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0765( Boundary ) FIXED GLOBAL;
! Makrofall 0765: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0766( Boundary ) FIXED GLOBAL;
! Makrofall 0766: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0767( Boundary ) FIXED GLOBAL;
! Makrofall 0767: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0768( Boundary ) FIXED GLOBAL;
! Makrofall 0768: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0769( Boundary ) FIXED GLOBAL;
! Makrofall 0769: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0770( Boundary ) FIXED GLOBAL;
! Makrofall 0770: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0771( Boundary ) FIXED GLOBAL;
! Makrofall 0771: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0772( Boundary ) FIXED GLOBAL;
! Makrofall 0772: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0773( Boundary ) FIXED GLOBAL;
! Makrofall 0773: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0774( Boundary ) FIXED GLOBAL;
! Makrofall 0774: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0775( Boundary ) FIXED GLOBAL;
! Makrofall 0775: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0776( Boundary ) FIXED GLOBAL;
! Makrofall 0776: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0777( Boundary ) FIXED GLOBAL;
! Makrofall 0777: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0778( Boundary ) FIXED GLOBAL;
! Makrofall 0778: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0779( Boundary ) FIXED GLOBAL;
! Makrofall 0779: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0780( Boundary ) FIXED GLOBAL;
! Makrofall 0780: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0781( Boundary ) FIXED GLOBAL;
! Makrofall 0781: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0782( Boundary ) FIXED GLOBAL;
! Makrofall 0782: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0783( Boundary ) FIXED GLOBAL;
! Makrofall 0783: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0784( Boundary ) FIXED GLOBAL;
! Makrofall 0784: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0785( Boundary ) FIXED GLOBAL;
! Makrofall 0785: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0786( Boundary ) FIXED GLOBAL;
! Makrofall 0786: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0787( Boundary ) FIXED GLOBAL;
! Makrofall 0787: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0788( Boundary ) FIXED GLOBAL;
! Makrofall 0788: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0789( Boundary ) FIXED GLOBAL;
! Makrofall 0789: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0790( Boundary ) FIXED GLOBAL;
! Makrofall 0790: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0791( Boundary ) FIXED GLOBAL;
! Makrofall 0791: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0792( Boundary ) FIXED GLOBAL;
! Makrofall 0792: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0793( Boundary ) FIXED GLOBAL;
! Makrofall 0793: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0794( Boundary ) FIXED GLOBAL;
! Makrofall 0794: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0795( Boundary ) FIXED GLOBAL;
! Makrofall 0795: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0796( Boundary ) FIXED GLOBAL;
! Makrofall 0796: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0797( Boundary ) FIXED GLOBAL;
! Makrofall 0797: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0798( Boundary ) FIXED GLOBAL;
! Makrofall 0798: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0799( Boundary ) FIXED GLOBAL;
! Makrofall 0799: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0800( Boundary ) FIXED GLOBAL;
! Makrofall 0800: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0801( Boundary ) FIXED GLOBAL;
! Makrofall 0801: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0802( Boundary ) FIXED GLOBAL;
! Makrofall 0802: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0803( Boundary ) FIXED GLOBAL;
! Makrofall 0803: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0804( Boundary ) FIXED GLOBAL;
! Makrofall 0804: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0805( Boundary ) FIXED GLOBAL;
! Makrofall 0805: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0806( Boundary ) FIXED GLOBAL;
! Makrofall 0806: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0807( Boundary ) FIXED GLOBAL;
! Makrofall 0807: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0808( Boundary ) FIXED GLOBAL;
! Makrofall 0808: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0809( Boundary ) FIXED GLOBAL;
! Makrofall 0809: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0810( Boundary ) FIXED GLOBAL;
! Makrofall 0810: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0811( Boundary ) FIXED GLOBAL;
! Makrofall 0811: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0812( Boundary ) FIXED GLOBAL;
! Makrofall 0812: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0813( Boundary ) FIXED GLOBAL;
! Makrofall 0813: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0814( Boundary ) FIXED GLOBAL;
! Makrofall 0814: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0815( Boundary ) FIXED GLOBAL;
! Makrofall 0815: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0816( Boundary ) FIXED GLOBAL;
! Makrofall 0816: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0817( Boundary ) FIXED GLOBAL;
! Makrofall 0817: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0818( Boundary ) FIXED GLOBAL;
! Makrofall 0818: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0819( Boundary ) FIXED GLOBAL;
! Makrofall 0819: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0820( Boundary ) FIXED GLOBAL;
! Makrofall 0820: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0821( Boundary ) FIXED GLOBAL;
! Makrofall 0821: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0822( Boundary ) FIXED GLOBAL;
! Makrofall 0822: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0823( Boundary ) FIXED GLOBAL;
! Makrofall 0823: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0824( Boundary ) FIXED GLOBAL;
! Makrofall 0824: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0825( Boundary ) FIXED GLOBAL;
! Makrofall 0825: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0826( Boundary ) FIXED GLOBAL;
! Makrofall 0826: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0827( Boundary ) FIXED GLOBAL;
! Makrofall 0827: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0828( Boundary ) FIXED GLOBAL;
! Makrofall 0828: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0829( Boundary ) FIXED GLOBAL;
! Makrofall 0829: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0830( Boundary ) FIXED GLOBAL;
! Makrofall 0830: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0831( Boundary ) FIXED GLOBAL;
! Makrofall 0831: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0832( Boundary ) FIXED GLOBAL;
! Makrofall 0832: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0833( Boundary ) FIXED GLOBAL;
! Makrofall 0833: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0834( Boundary ) FIXED GLOBAL;
! Makrofall 0834: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0835( Boundary ) FIXED GLOBAL;
! Makrofall 0835: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0836( Boundary ) FIXED GLOBAL;
! Makrofall 0836: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0837( Boundary ) FIXED GLOBAL;
! Makrofall 0837: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0838( Boundary ) FIXED GLOBAL;
! Makrofall 0838: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0839( Boundary ) FIXED GLOBAL;
! Makrofall 0839: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0840( Boundary ) FIXED GLOBAL;
! Makrofall 0840: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0841( Boundary ) FIXED GLOBAL;
! Makrofall 0841: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0842( Boundary ) FIXED GLOBAL;
! Makrofall 0842: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0843( Boundary ) FIXED GLOBAL;
! Makrofall 0843: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0844( Boundary ) FIXED GLOBAL;
! Makrofall 0844: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0845( Boundary ) FIXED GLOBAL;
! Makrofall 0845: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0846( Boundary ) FIXED GLOBAL;
! Makrofall 0846: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0847( Boundary ) FIXED GLOBAL;
! Makrofall 0847: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0848( Boundary ) FIXED GLOBAL;
! Makrofall 0848: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0849( Boundary ) FIXED GLOBAL;
! Makrofall 0849: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0850( Boundary ) FIXED GLOBAL;
! Makrofall 0850: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0851( Boundary ) FIXED GLOBAL;
! Makrofall 0851: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0852( Boundary ) FIXED GLOBAL;
! Makrofall 0852: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0853( Boundary ) FIXED GLOBAL;
! Makrofall 0853: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0854( Boundary ) FIXED GLOBAL;
! Makrofall 0854: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0855( Boundary ) FIXED GLOBAL;
! Makrofall 0855: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0856( Boundary ) FIXED GLOBAL;
! Makrofall 0856: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0857( Boundary ) FIXED GLOBAL;
! Makrofall 0857: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0858( Boundary ) FIXED GLOBAL;
! Makrofall 0858: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0859( Boundary ) FIXED GLOBAL;
! Makrofall 0859: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0860( Boundary ) FIXED GLOBAL;
! Makrofall 0860: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0861( Boundary ) FIXED GLOBAL;
! Makrofall 0861: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0862( Boundary ) FIXED GLOBAL;
! Makrofall 0862: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0863( Boundary ) FIXED GLOBAL;
! Makrofall 0863: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0864( Boundary ) FIXED GLOBAL;
! Makrofall 0864: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0865( Boundary ) FIXED GLOBAL;
! Makrofall 0865: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0866( Boundary ) FIXED GLOBAL;
! Makrofall 0866: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0867( Boundary ) FIXED GLOBAL;
! Makrofall 0867: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0868( Boundary ) FIXED GLOBAL;
! Makrofall 0868: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0869( Boundary ) FIXED GLOBAL;
! Makrofall 0869: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0870( Boundary ) FIXED GLOBAL;
! Makrofall 0870: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0871( Boundary ) FIXED GLOBAL;
! Makrofall 0871: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0872( Boundary ) FIXED GLOBAL;
! Makrofall 0872: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0873( Boundary ) FIXED GLOBAL;
! Makrofall 0873: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0874( Boundary ) FIXED GLOBAL;
! Makrofall 0874: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0875( Boundary ) FIXED GLOBAL;
! Makrofall 0875: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0876( Boundary ) FIXED GLOBAL;
! Makrofall 0876: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0877( Boundary ) FIXED GLOBAL;
! Makrofall 0877: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0878( Boundary ) FIXED GLOBAL;
! Makrofall 0878: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0879( Boundary ) FIXED GLOBAL;
! Makrofall 0879: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0880( Boundary ) FIXED GLOBAL;
! Makrofall 0880: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0881( Boundary ) FIXED GLOBAL;
! Makrofall 0881: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0882( Boundary ) FIXED GLOBAL;
! Makrofall 0882: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0883( Boundary ) FIXED GLOBAL;
! Makrofall 0883: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0884( Boundary ) FIXED GLOBAL;
! Makrofall 0884: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0885( Boundary ) FIXED GLOBAL;
! Makrofall 0885: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0886( Boundary ) FIXED GLOBAL;
! Makrofall 0886: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0887( Boundary ) FIXED GLOBAL;
! Makrofall 0887: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0888( Boundary ) FIXED GLOBAL;
! Makrofall 0888: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0889( Boundary ) FIXED GLOBAL;
! Makrofall 0889: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0890( Boundary ) FIXED GLOBAL;
! Makrofall 0890: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0891( Boundary ) FIXED GLOBAL;
! Makrofall 0891: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0892( Boundary ) FIXED GLOBAL;
! Makrofall 0892: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0893( Boundary ) FIXED GLOBAL;
! Makrofall 0893: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0894( Boundary ) FIXED GLOBAL;
! Makrofall 0894: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0895( Boundary ) FIXED GLOBAL;
! Makrofall 0895: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0896( Boundary ) FIXED GLOBAL;
! Makrofall 0896: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0897( Boundary ) FIXED GLOBAL;
! Makrofall 0897: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0898( Boundary ) FIXED GLOBAL;
! Makrofall 0898: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0899( Boundary ) FIXED GLOBAL;
! Makrofall 0899: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0900( Boundary ) FIXED GLOBAL;
! Makrofall 0900: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0901( Boundary ) FIXED GLOBAL;
! Makrofall 0901: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0902( Boundary ) FIXED GLOBAL;
! Makrofall 0902: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0903( Boundary ) FIXED GLOBAL;
! Makrofall 0903: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0904( Boundary ) FIXED GLOBAL;
! Makrofall 0904: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0905( Boundary ) FIXED GLOBAL;
! Makrofall 0905: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0906( Boundary ) FIXED GLOBAL;
! Makrofall 0906: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0907( Boundary ) FIXED GLOBAL;
! Makrofall 0907: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0908( Boundary ) FIXED GLOBAL;
! Makrofall 0908: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0909( Boundary ) FIXED GLOBAL;
! Makrofall 0909: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0910( Boundary ) FIXED GLOBAL;
! Makrofall 0910: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0911( Boundary ) FIXED GLOBAL;
! Makrofall 0911: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0912( Boundary ) FIXED GLOBAL;
! Makrofall 0912: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0913( Boundary ) FIXED GLOBAL;
! Makrofall 0913: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0914( Boundary ) FIXED GLOBAL;
! Makrofall 0914: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0915( Boundary ) FIXED GLOBAL;
! Makrofall 0915: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0916( Boundary ) FIXED GLOBAL;
! Makrofall 0916: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0917( Boundary ) FIXED GLOBAL;
! Makrofall 0917: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0918( Boundary ) FIXED GLOBAL;
! Makrofall 0918: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0919( Boundary ) FIXED GLOBAL;
! Makrofall 0919: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0920( Boundary ) FIXED GLOBAL;
! Makrofall 0920: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0921( Boundary ) FIXED GLOBAL;
! Makrofall 0921: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0922( Boundary ) FIXED GLOBAL;
! Makrofall 0922: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0923( Boundary ) FIXED GLOBAL;
! Makrofall 0923: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0924( Boundary ) FIXED GLOBAL;
! Makrofall 0924: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0925( Boundary ) FIXED GLOBAL;
! Makrofall 0925: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0926( Boundary ) FIXED GLOBAL;
! Makrofall 0926: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0927( Boundary ) FIXED GLOBAL;
! Makrofall 0927: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0928( Boundary ) FIXED GLOBAL;
! Makrofall 0928: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0929( Boundary ) FIXED GLOBAL;
! Makrofall 0929: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0930( Boundary ) FIXED GLOBAL;
! Makrofall 0930: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0931( Boundary ) FIXED GLOBAL;
! Makrofall 0931: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0932( Boundary ) FIXED GLOBAL;
! Makrofall 0932: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0933( Boundary ) FIXED GLOBAL;
! Makrofall 0933: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0934( Boundary ) FIXED GLOBAL;
! Makrofall 0934: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0935( Boundary ) FIXED GLOBAL;
! Makrofall 0935: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0936( Boundary ) FIXED GLOBAL;
! Makrofall 0936: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0937( Boundary ) FIXED GLOBAL;
! Makrofall 0937: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0938( Boundary ) FIXED GLOBAL;
! Makrofall 0938: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0939( Boundary ) FIXED GLOBAL;
! Makrofall 0939: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0940( Boundary ) FIXED GLOBAL;
! Makrofall 0940: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0941( Boundary ) FIXED GLOBAL;
! Makrofall 0941: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0942( Boundary ) FIXED GLOBAL;
! Makrofall 0942: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0943( Boundary ) FIXED GLOBAL;
! Makrofall 0943: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0944( Boundary ) FIXED GLOBAL;
! Makrofall 0944: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0945( Boundary ) FIXED GLOBAL;
! Makrofall 0945: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0946( Boundary ) FIXED GLOBAL;
! Makrofall 0946: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0947( Boundary ) FIXED GLOBAL;
! Makrofall 0947: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0948( Boundary ) FIXED GLOBAL;
! Makrofall 0948: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0949( Boundary ) FIXED GLOBAL;
! Makrofall 0949: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0950( Boundary ) FIXED GLOBAL;
! Makrofall 0950: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0951( Boundary ) FIXED GLOBAL;
! Makrofall 0951: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0952( Boundary ) FIXED GLOBAL;
! Makrofall 0952: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0953( Boundary ) FIXED GLOBAL;
! Makrofall 0953: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0954( Boundary ) FIXED GLOBAL;
! Makrofall 0954: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0955( Boundary ) FIXED GLOBAL;
! Makrofall 0955: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0956( Boundary ) FIXED GLOBAL;
! Makrofall 0956: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0957( Boundary ) FIXED GLOBAL;
! Makrofall 0957: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0958( Boundary ) FIXED GLOBAL;
! Makrofall 0958: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0959( Boundary ) FIXED GLOBAL;
! Makrofall 0959: VAR + Boundary + WertIst + Count + WertEnde.
VAR StressShared0960( Boundary ) FIXED GLOBAL;
! Makrofall 0960: VAR + Boundary + WertIst + Count + WertEnde.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
! Makroexpansion und Location-Mapping: Testdatei mit stabiler Zeilenzahl.
