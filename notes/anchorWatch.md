# Android Behavior

### anchor:
    PUT /v3/anchorwatch/AnchorWatchControl
        { 
            '{
                "setAnchor":true,
                "alarmsEnabled":true,
                "anchorPosition":
                    {
                        "a":-99311605,
                        "o":-1326057613,
                        "t":1743325352794
                    }
            }': '' 
        } 

### raise anchor
    PUT /v3/anchorwatch/AnchorWatchControl 
        { 
            '{
                "setAnchor":false,
                "alarmsEnabled":false
            }': '' 
        }

### change radius:
    PUT /v3/anchorwatch/AnchorWatchControl 
        { 
            '{
                "alarmRadius":60.0
            }': '' 
        }

### data models

#### AnchorWatch @RetainForSeconds(tickle = true, value = 15L)
    VesselPosition[] anchorPreviousPositions
        ObservedPosition bowPosition
            (String latUserString;)
            double latitude;
            (String lngUserString;)
            double longitude;
            long time;
        boolean hasBowOffset;
        int latBowOffsetMeters = Integer.MAX_VALUE;
        int lonBowOffsetMeters = Integer.MAX_VALUE;
        ...extends ObservedPosition:
        (String latUserString;)
        double latitude;
        (String lngUserString;)
        double longitude;
        long time;
    boolean outOfBounds

    constructor:

    public VesselPosition(VesselPosition paramVesselPosition) {
        this.latitude = paramVesselPosition.latitude;
        this.longitude = paramVesselPosition.longitude;
        this.time = paramVesselPosition.time;
        this.latBowOffsetMeters = paramVesselPosition.latBowOffsetMeters;
        this.lonBowOffsetMeters = paramVesselPosition.lonBowOffsetMeters;
        this.hasBowOffset = paramVesselPosition.hasBowOffset;
    }

#### AnchorWatchControl @RetainForSeconds(tickle = true, value = 15L)
    float alarmRadius;
    boolean alarmsEnabled;
    VesselPosition anchorPosition;
        ObservedPosition bowPosition
            (String latUserString;)
            double latitude;
            (String lngUserString;)
            double longitude;
            long time;
        boolean hasBowOffset;
        int latBowOffsetMeters = Integer.MAX_VALUE;
        int lonBowOffsetMeters = Integer.MAX_VALUE;
        ...extends ObservedPosition:
        (String latUserString;)
        double latitude;
        (String lngUserString;)
        double longitude;
        long time;
    boolean setAnchor;

    constructor:

    public static AnchorWatchControl copyOf(AnchorWatchControl paramAnchorWatchControl) {
        AnchorWatchControl anchorWatchControl = new AnchorWatchControl();
        if (paramAnchorWatchControl != null) {
            anchorWatchControl.alarmsEnabled = paramAnchorWatchControl.alarmsEnabled;
            anchorWatchControl.setAnchor = paramAnchorWatchControl.setAnchor;
            anchorWatchControl.anchorPosition = paramAnchorWatchControl.anchorPosition;
            anchorWatchControl.alarmRadius = paramAnchorWatchControl.alarmRadius;
        }
        return anchorWatchControl;
    }

    android parser:

    alarmRadius
    alarmsEnabled
    anchorPosition
        hasBowOffset
        da = latBowOffsetMeters
        do = lonBowOffsetMeters
    setAnchor





# iOS Behavior

### anchor:
    GET /datamodel/propertyEdited?AnchorWatch.setAnchor=1 
        {"AnchorWatch.setAnchor":"1"}

### periodic checking of anchore status while anchored:
    GET /datamodel/getModel?AnchorWatch 
        {"AnchorWatch":""}

### raise anchor
    GET /datamodel/propertyEdited?AnchorWatch.setAnchor=0 
        {"AnchorWatch.setAnchor":"0"}

### change radius:
    GET /datamodel/propertyEdited?AnchorWatch.alarmRadius=60 
        {"AnchorWatch.alarmRadius":"60"}


# Previous code
    var anchorWatchControl = {
        "anchorPosition"    :   anchorWatch.setAnchor == 0 ? {} : {
            "a"             :   Math.round(anchorWatch.lat * 1e7), 
            "o"             :   Math.round(anchorWatch.lon * 1e7), 
            "t"             :   anchorWatch.time,
            "hasBowOffset"  :   false,
            "da"            :   0,
            "do"            :   0
        }, 
        "setAnchor"         :   (anchorWatch.setAnchor == 1), 
        "alarmRadius"       :   anchorWatch.alarmRadius, 
        "alarmsEnabled"     :   (anchorWatch.alarmsEnabled == 1)
    };




