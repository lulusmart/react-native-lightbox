import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Animated, Dimensions, Modal, PanResponder, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View, LayoutAnimation } from 'react-native';

const WINDOW_HEIGHT = Dimensions.get('window').height;
const WINDOW_WIDTH = Dimensions.get('window').width;
const DRAG_DISMISS_THRESHOLD = 150;
const STATUS_BAR_OFFSET = (Platform.OS === 'android' ? -25 : 0);
const isIOS = Platform.OS === 'ios';
const DEFAULT_DURATION = 300;

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  open: {
    position: 'absolute',
    flex: 1,
    justifyContent: 'center',
    // Android pan handlers crash without this declaration:
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    backgroundColor: 'transparent',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: WINDOW_WIDTH,
    backgroundColor: 'transparent',
  },
  closeButton: {
    fontSize: 35,
    color: 'white',
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 1.5,
    shadowColor: 'black',
    shadowOpacity: 0.8,
  },
});

export default class LightboxOverlay extends Component {
  static propTypes = {
    origin: PropTypes.shape({
      x:        PropTypes.number,
      y:        PropTypes.number,
      width:    PropTypes.number,
      height:   PropTypes.number,
    }),
    springConfig: PropTypes.shape({
      tension:  PropTypes.number,
      friction: PropTypes.number,
    }),
    backgroundColor: PropTypes.string,
    isOpen:          PropTypes.bool,
    renderHeader:    PropTypes.func,
    onOpen:          PropTypes.func,
    onClose:         PropTypes.func,
    willClose:         PropTypes.func,
    swipeToDismiss:  PropTypes.bool,
  };

  static defaultProps = {
    springConfig: { tension: 30, friction: 7 },
    backgroundColor: 'black',
  };

  state = {
    isPanning: false,
    target: {
      x: 0,
      y: 0,
      opacity: 1,
    },
    pan: new Animated.Value(0),
    opacity: new Animated.Value(0),
    open: false,
  };

  componentWillMount() {
    this._panResponder = PanResponder.create({
      // Ask to be the responder:
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,

      onPanResponderGrant: (evt, gestureState) => {
        this.state.pan.setValue(0);
        this.setState({ isPanning: true });
      },
      onPanResponderMove: Animated.event([
        null,
        { dy: this.state.pan }
      ]),
      onPanResponderTerminationRequest: (evt, gestureState) => true,
      onPanResponderRelease: (evt, gestureState) => {
        if(Math.abs(gestureState.dy) > DRAG_DISMISS_THRESHOLD) {
          this.setState({
            isPanning: false,
            target: {
              y: gestureState.dy,
              x: gestureState.dx,
              opacity: 1 - Math.abs(gestureState.dy / WINDOW_HEIGHT)
            }
          });
          this.close();
        } else {
          Animated.spring(
            this.state.pan,
            { toValue: 0, ...this.props.springConfig }
          ).start(() => { this.setState({ isPanning: false }); });
        }
      },
    });
  }

  componentDidMount() {
    if(this.props.isOpen) {
      this.open();
    }
  }

  open = () => {
    if(isIOS) {
      StatusBar.setHidden(true, 'fade');
    }
    this.state.pan.setValue(0);
    this.setState({
      target: {
        x: 0,
        y: 0,
        opacity: 1,
      }
    });
    Animated.timing(this.state.opacity, {
      toValue: 1,
      duration: DEFAULT_DURATION
    }).start();
    LayoutAnimation.configureNext({
      duration: DEFAULT_DURATION,
      update: {type: LayoutAnimation.Types.easing}
    });
    this.setState({open: true}, () => {
      this.props.didOpen();
    });
  }

  close = () => {
    this.props.willClose();
    if(isIOS) {
      StatusBar.setHidden(false, 'fade');
    }
    Animated.timing(this.state.opacity, {
      toValue: 0,
      duration: DEFAULT_DURATION
    }).start();
    LayoutAnimation.configureNext({
      duration: DEFAULT_DURATION,
      update: {type: LayoutAnimation.Types.easing}
    });
    this.setState({open: false}, () => {
      setTimeout(() => this.props.onClose(), DEFAULT_DURATION);
    });
  }

  componentWillReceiveProps(props) {
    if(this.props.isOpen != props.isOpen && props.isOpen) {
      setTimeout(() => this.open(), 1);
    }
  }

  render() {
    const {
      isOpen,
      renderHeader,
      renderFooter,
      swipeToDismiss,
      origin,
      backgroundColor,
    } = this.props;

    const {
      isPanning,
      open,
      target,
    } = this.state;

    const lightboxOpacityStyle = {
      opacity: this.state.opacity.interpolate({inputRange: [0, 1], outputRange: [0, target.opacity]})
    };

    let handlers;
    if(swipeToDismiss) {
      handlers = this._panResponder.panHandlers;
    }

    let dragStyle;
    if(isPanning) {
      dragStyle = {
        transform: [{translateY: this.state.pan}]
      };
      lightboxOpacityStyle.opacity = this.state.pan.interpolate({inputRange: [-WINDOW_HEIGHT, 0, WINDOW_HEIGHT], outputRange: [0, 1, 0]});
    }

    let targetHeight;
    let targetTop
    if (this.props.targetHeight) {
      targetHeight = this.props.targetHeight;
      targetTop = (WINDOW_HEIGHT - STATUS_BAR_OFFSET - targetHeight) / 2 + STATUS_BAR_OFFSET;
    } else {
      targetHeight = WINDOW_HEIGHT;
      targetTop = target.y + STATUS_BAR_OFFSET;
    }

    const openStyle = [styles.open, {
      left:   open ? target.x : origin.x,
      top:    open ? targetTop : origin.y + STATUS_BAR_OFFSET,
      width:  open ? WINDOW_WIDTH : origin.width,
      height: open ? targetHeight : origin.height
    }];

    const background = (<Animated.View style={[styles.background, { backgroundColor: backgroundColor }, lightboxOpacityStyle]}></Animated.View>);
    const header = (<Animated.View style={[styles.header, lightboxOpacityStyle]}>{(renderHeader ?
      renderHeader(this.close) :
      (
        <TouchableOpacity onPress={this.close}>
          <Text style={styles.closeButton}>×</Text>
        </TouchableOpacity>
      )
    )}</Animated.View>);
    const content = (
      <Animated.View style={[openStyle, dragStyle]} {...handlers}>
        {this.props.children}
      </Animated.View>
    );
    const footer = (<Animated.View style={[styles.footer, lightboxOpacityStyle]}>{(renderFooter ? renderFooter() : null )}</Animated.View>);

    if (this.props.navigator) {
      return (
        <View>
          {background}
          {content}
          {header}
          {footer}
        </View>
      );
    }

    return (
      <Modal visible={isOpen} transparent={true} onRequestClose={() => this.close()}>
        {background}
        {content}
        {header}
        {footer}
      </Modal>
    );
  }
}
