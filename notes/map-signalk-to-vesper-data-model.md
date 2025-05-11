
        //app.debug('delta', JSON.stringify(delta, null, "\t"));
        //app.debug('app.getSelfPath', app.getSelfPath('mmsi'), app.getSelfPath('uuid'), app.getSelfPath('navigation.courseOverGroundTrue'));

        /* sample delta:
        delta {
                "context": "vessels.urn:mrn:imo:mmsi:368204530",
                "updates": [
                        {
                                "source": {
                                        "sentence": "RMC",
                                        "talker": "GP",
                                        "type": "NMEA0183",
                                        "label": "vesper"
                                },
                                "$source": "vesper.GP",
                                "timestamp": "2025-03-27T00:22:52.000Z",
                                "values": [
                                        {
                                                "path": "navigation.position",
                                                "value": {
                                                        "longitude": -126.11581616666666,
                                                        "latitude": -9.898707666666667
                                                }
                                        }
                                ]
                        }
                ]
        }
        */




        /*
        mmsi              y y   mmsi
        name              y y   name
        lat               y y   navigation.position.latitude
        lon               y y   navigation.position.longitude
        cog               y y   navigation.courseOverGroundTrue
        sog               y y   navigation.speedOverGround
        hdg               y y   navigation.headingTrue
        rot               y y   navigation.rateOfTurn
        typeId            y y   design.aisShipType.id
        type              y y   design.aisShipType.name
        navstatus         y y   navigation.state                    FIXME: navstatus needs to be numeric, but navigation.state is descriptive text
        aisClass          y y   sensors.ais.class                   A, B, ATON, BASE
        callsign          y y   communication.callsignVhf
        imo               y y   registrations.imo
        destination       y y   navigation.destination.commonName
        length            y y   design.length.overall
        width             y y   design.beam
        draft             y y   design.draft.current
        targetType        - y   <<<derived>>>
        
                                sensors.ais.functionalId            10
                                                                    1-27 "AIS Message Type" / aisType
                                                                    1 
                                                                    2 
                                                                    3 = class A
                                                                    4 = base station
                                                                    5 = extended class A
                                                                    6 
                                                                    7 
                                                                    8 = binary message
                                                                    9 = sar aircraft
                                                                    10 
                                                                    11 = uxt/date response
                                                                    12 
                                                                    13 
                                                                    14 = text message
                                                                    15
                                                                    16
                                                                    17
                                                                    18 = class B
                                                                    19 = class B extended
                                                                    20
                                                                    21 = aid to navigation / aton
                                                                    22
                                                                    23
                                                                    24 = class B more ext
                                                                    25
                                                                    26
                                                                    27 = long range ais broadcast

        atonType
        1 = Reference Point
        3 = Fixed Structure Off Shore

        */


        // class a > type 1
        // class b > type 2
        // atons > type 4
        // sar vessel > type 5
        // sart > type 6
        // mob > type 7
        // epirb > type 8

        // 8MIDXXXXX        Diver’s radio (not used in the U.S. in 2013)
        // MIDXXXXXX        Ship
        // 0MIDXXXXX        Group of ships; the U.S. Coast Guard, for example, is 03699999
        // 00MIDXXXX        Coastal stations
        // 111MIDXXX        SAR (Search and Rescue) aircraft
        // 99MIDXXXX        Aids to Navigation
        // 98MIDXXXX        Auxiliary craft associated with a parent ship
        // 970MIDXXX        AIS SART (Search and Rescue Transmitter)
        // 972XXXXXX        MOB (Man Overboard) device
        // 974XXXXXX        EPIRB (Emergency Position Indicating Radio Beacon) AIS

        // 002442000 does not work in the android app
        // 002442016 does not work either
        //      the above two are like: 00MIDXXXX        Coastal stations
        // 992446000 does work though
        // all these targets are otherwise pretty identical ATON targets
        // i'm guessing this is just a bug in how the android app validates/processes the mmsi


    /*
    target.vesperTargetType:
    0 = triangle                  *                                                                      0 is not a thing?
    1 = big pointy box               y               class A                                             >>> class A ships
         does not render a symbol in ios unless you add.... navigation.state
    2 = triangle                     Y               class B. sailing vessels are rendered with sails    >>>> class B sail / power
         does not render a symbol in ios unless you add.... navigation.state
    3 = triangle                     ?????????       class B. sailing vessels not rendered with sails    ?
    4 = diamond                      Y               atons. diamnods. no fill.                           >>>> atons
    5 = triangle                     ?????????       class B. sailing vessels not rendered with sails    ?
    6 = circle/cross                 y               SART                                                >>>> sart
    7 = circle/cross                 y               MOB                                                 >>>> mob
    8 = circle/cross                 y               EPIRB                                               >>>> epirb
    9 = triangle
    10 = triangle

    really? 993?
    993 = aton AToN                  ?????????       triangle

    navState mappings:
    'motoring': 0,
    'anchored': 1,
    'not under command': 2,
    'restricted manouverability': 3,
    'constrained by draft': 4,
    'moored': 5,
    'aground': 6,
    'fishing': 7,
    'sailing': 8,
    'hazardous material high speed': 9,
    'hazardous material wing in ground': 10,
    'ais-sart': 14,
    'default': 15,

    design.aisShipType:
    0 = default
    20 = wig
    30 = fishing
    31 = towing
    33 = dredge
    35 = military
    36 = sailing
    37 = pleasure
    40 = high speed
    50 = pilot
    51 = sar
    52 = tug
    60 = passenger
    70 = cargo
    80 = tanker

    */

    // create some dummy vessels doe testing
    /*
    setInterval(() => {


        var shipTypes = new Map([
            [0, 'default'],
            [20, 'wig'],
            [30, 'fishing'],            // ios/android fishing boat symbol in table
            [31, 'towing'],             // ios/android tug symbol in table                  android renders a double dot on the plotter
            [33, 'dredge'],
            [35, 'military'],
            [36, 'sailing'],            // ios/android sail boat symbol in table            android renders a sail on the plotter
            [37, 'pleasure'],           // ios/android power boat symbol in table
            [40, 'high speed'],
            [50, 'pilot'],
            [51, 'sar'],
            [52, 'tug'],                // ios/android tug symbol in table                  android renders a double dot on the plotter
            [60, 'passenger'],
            [70, 'cargo'],
            [80, 'tanker']
        ]);

        // switching aisClass between A and B does not seem to affect symbols used
        // switch target type from 1 to ....2 just switches to small trfiangle
        // target type 3 renders vertical symbols (no cog rotation) in android plotter; and no symbols in the table/list; ios shows all ship symbols in the table + triangles in plotter 
        // target type 4 renders atons in table and small triangles in plotter on android; and atons in both on ios
        // target type 5 renders cicle/cross in table and small triangle in plotter on android; ship symbols in table and small triangle on plotter in ios >>> SAR
        // target type 6 renders cicle/cross in table and small triangle in plotter on android; cicle/cross in table and plotter on ios >>> SART
        // target type 7 renders cicle/cross in table and small triangle in plotter on android; cicle/cross in table and plotter on ios >>> MOB
        // target type 8 renders no symbol in table and non-rotated small triangle in plotter on android; cicle/cross in table and plotter on ios >>> EPIRB
        // target type 9 renders no symbol in table and non-rotated small triangle in plotter on android; ship symbols in table and small triangle on plotter in ios
        // target type 10 same as 9

        // so...
        // class a > type 1
        // class b > type 2
        // atons > type 4
        // sar vessel > type 5
        // sart > type 6
        // mob > type 7
        // epirb > type 8

        //for (let i = 0; i <= 15; i++) {

        var i = 0;
        for (var shipTypeId of shipTypes.keys()) {
            //app.debug('shipTypeId', shipTypeId, shipTypes.get(shipTypeId));
            //              mmsi,          lat,            lon,                    cog,    sog, 
            //                                                                                aisClass, 
            //                                                                                     targetType, 
            //                                                                                          navState,                     
            //                                                                                              shipTypeId)
            sendVesselDelta(500000000 + i, gps.lat - 0.05, gps.lon - 0.5 + i / 10, i * 15, 10, 'B', 3, 15, shipTypeId, shipTypes.get(shipTypeId));
            i++;

            // sendVesselDelta(500000000 + i, gps.lat - 0.05, gps.lon - 0.5 + i / 10, i * 15, 1, 'A', i);   
            // sendVesselDelta(600000000 + i, gps.lat - 0.1, gps.lon - 0.5 + i / 10, i * 15, 1, 'B', i);
            // sendVesselDelta(700000000 + i, gps.lat - 0.15, gps.lon - 0.5 + i / 10, i * 15, 1, 'ATON', i);

            // if (stateMappingNumericToText[i]) {
            //     sendVesselDelta(500000000 + i, gps.lat - 0.05, gps.lon - 0.5 + i / 10, i * 15, 1, 'A', 1, stateMappingNumericToText[i]);
            //     sendVesselDelta(600000000 + i, gps.lat - 0.1, gps.lon - 0.5 + i / 10, i * 15, 1, 'B', 2, stateMappingNumericToText[i]);
            // }
        }
    }, 5000);
    */

