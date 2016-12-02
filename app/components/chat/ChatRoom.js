import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import Helmet from 'react-helmet'
import Notification from './Notification'
import Messages from './Messages'
import Messenger from './Messenger'
// constant
import { PATIENT } from '../../constants'
// material ui
import { Paper } from 'material-ui'

// ChatRoom is a local state component that handles messages to/from
// patient and therapist

// -=-=-=-=-=-= COMPONENT =-=-=-=-=-=-

const PLACEHOLDER = '\xa0'  // to hold uniform height in notifications display

export class ChatRoom extends Component {

  constructor(props) {
    super(props)
    // local state of user, messages array, and 'wipe clean' message
    this.state = {
      user: this.props.user,
      messages: [],
      message: '',
      notifications: '\xa0'
    }
    // pick a unique room for the therapist-patient chat based on patient id
    this.room = this.props.params.room
    // bind our methods to use in render()
    this.onMessageReceived = this.onMessageReceived.bind(this)
    this.onMessageSent = this.onMessageSent.bind(this)
    this.onMessageChange = this.onMessageChange.bind(this)
    this.onNotification = this.onNotification.bind(this)
  }

  componentDidMount() {
    // initialize client socket
    this.socket = io.connect()
    // let server know the room to 'speak' in and that a user has entered that room
    this.socket.emit('userEnter', { room: this.room, user: this.state.user })
    // workhorse function on client side for message handling
    this.socket.on('newMessage', this.onMessageReceived)
    this.socket.on('notification', this.onNotification)
  }

  componentWillUnmount() {
    // notify departure on chat close
    this.socket.emit('userLeave', { room: this.room, user: this.state.user })
  }

  onMessageReceived(data) {
    let message = {}
    if (data.user.id === this.state.user.id) {
      message = {
        user: data.user, // messages have a user with img and name
        text: data.text, // and a regular font text that follows
        align: 'right'   // messages from you are green and on the right
      }
    } else {
      message = {
        user: data.user,
        text: data.text,
        align: 'left'   // messages from chat partner are blue and on the left
      }
    }
    // put message on the local state for rendering
    this.setState({ messages: [...this.state.messages, message] })
  }

  onMessageSent(evt) {
    evt.preventDefault()
    let message = {
      user: this.state.user,
      text: this.state.message,
    }
    // broadcast the message
    this.socket.emit('newMessage', message)
     // wipe clean the message prop
    this.setState({ message: '' })
  }

  onMessageChange(evt) {
    this.setState({ message: evt.target.value })
    this.socket.emit('typing', { user: this.state.user })
  }
 // these are all user actions, not limited to notifications to a therapist
 // of a patient being in the chat, which alone are dispatched to the redux store
  onNotification(data) {
    if (this.state.notifications === PLACEHOLDER) {  // prevent notification "races"
      this.setState({ notifications: data })
      setTimeout(() => this.setState({ notifications: PLACEHOLDER }), 4000)
    }
  }

  render() {

    return (
      <div className='container chat'>
      <Helmet title='Chat' />
        <Paper
          className='col-xs-12 col-sm-12 col-md-6 col-md-offset-3'
          style={{ height: '90%' }}>
          <Notification notifications={ this.state.notifications } />
          <Messages messages={ this.state.messages } />
          <Messenger
            message={ this.state.message }
            onMessageChange={ this.onMessageChange }
            onMessageSent={ this.onMessageSent }
          />
        </Paper>
      </div>
    )
  }
}

// -=-=-=-=-=-= CONTAINER =-=-=-=-=-=-

const mapState = ({ user, currentPatient }) => ({ user, currentPatient })

export default connect(mapState)(ChatRoom)
